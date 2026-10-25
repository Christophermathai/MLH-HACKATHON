import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import {
  Side,
  LIMITS,
  parseClientMessage,
  createServerMessage,
  sanitizeError,
  ClaimParticipantRequestSchema,
  ZoomOutPublicError,
} from "@zoomout/contracts";
import { ServerConfig, isOriginAllowed } from "./config.js";
import { SessionStore } from "./sessions/sessionStore.js";
import { SessionLifecycleManager } from "./sessions/lifecycle.js";
import { SessionRecoveryManager } from "./sessions/recovery.js";
import { PipelineOrchestrator } from "./sessions/orchestrator.js";
import { AudioReceiver } from "./audio/audioReceiver.js";
import {
  FakeSttProvider,
  FakeAnalystProvider,
  FakeMediatorProvider,
  FakeJudgeStreamProvider,
  FakeTtsProvider,
} from "./providers/fakeProviders.js";
import { WhisperSttProvider } from "./providers/whisperStt.js";
import { SttProvider } from "./providers/types.js";
import { sendToSide, broadcast } from "./transport/projections.js";
import { transitionParticipant } from "./sessions/stateMachine.js";

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > LIMITS.MAX_CONTROL_JSON_BYTES) {
        reject(new ZoomOutPublicError("LIMIT_EXCEEDED", "Payload exceeds limit"));
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        return resolve({});
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new ZoomOutPublicError("BAD_EVENT", "Malformed JSON request body"));
      }
    });
    req.on("error", reject);
  });
}

export function createGatewayServer(config: ServerConfig) {
  const wss = new WebSocketServer({ noServer: true });
  const store = new SessionStore();
  // Mock / Live providers
  const sttProvider: SttProvider =
    config.providerMode === "live"
      ? new WhisperSttProvider({ openaiApiKey: config.openaiApiKey })
      : new FakeSttProvider();
  const analystProvider = new FakeAnalystProvider();
  const mediatorProvider = new FakeMediatorProvider();
  const judgeProvider = new FakeJudgeStreamProvider();
  const ttsProvider = new FakeTtsProvider();

  const audioReceiver = new AudioReceiver(sttProvider);
  const orchestrator = new PipelineOrchestrator(
    analystProvider,
    mediatorProvider,
    judgeProvider,
    ttsProvider
  );
  const lifecycle = new SessionLifecycleManager(store, (room) => {
    audioReceiver.cleanupRoom(room);
  });
  const recovery = new SessionRecoveryManager();

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;

    if (origin && !isOriginAllowed(origin, config.allowedOrigins)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "FORBIDDEN_ORIGIN", message: "Origin not allowed" }));
      return;
    }

    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);

    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/health")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          mode: config.providerMode,
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    // POST /api/rooms
    if (req.method === "POST" && url.pathname === "/api/rooms") {
      try {
        const roomA = store.createRoom();
        const session = store.getSession(roomA.room)!;
        lifecycle.scheduleExpiry(session);

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify(roomA));
        return;
      } catch (err: any) {
        const sanitized = sanitizeError(err);
        res.writeHead(sanitized.code === "CAPACITY" ? 503 : 400, { "Content-Type": "application/json" });
        res.end(JSON.stringify(sanitized));
        return;
      }
    }

    // POST /api/rooms/:room/participants
    const participantMatch = url.pathname.match(/^\/api\/rooms\/([a-zA-Z0-9]{8})\/participants$/);
    if (req.method === "POST" && participantMatch) {
      const roomCode = participantMatch[1].toUpperCase();

      try {
        const body = await readJsonBody(req);
        const parsed = ClaimParticipantRequestSchema.safeParse(body);
        if (!parsed.success || parsed.data.side !== "B") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ code: "BAD_EVENT", message: "Only side B can be claimed" }));
          return;
        }

        const roomB = store.claimSideB(roomCode);
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify(roomB));
        return;
      } catch (err: any) {
        const sanitized = sanitizeError(err);
        let status = 400;
        if (sanitized.code === "SESSION_UNAVAILABLE") status = 404;
        if (sanitized.code === "SIDE_TAKEN") status = 409;
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(sanitized));
        return;
      }
    }

    // Default 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "NOT_FOUND", message: "Route not found" }));
  });

  server.on("upgrade", (req, socket, head) => {
    const origin = req.headers.origin;
    if (origin && !isOriginAllowed(origin, config.allowedOrigins)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    if (url.pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    let boundRoomCode: string | null = null;
    let boundSide: Side | null = null;

    ws.on("message", async (data: Buffer | string, isBinary: boolean) => {
      if (isBinary) {
        if (!boundRoomCode || !boundSide) {
          return;
        }
        const session = store.getSession(boundRoomCode);
        if (!session) {
          return;
        }
        const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
        await audioReceiver.handleAudioChunk(session, boundSide, chunk);
        return;
      }

      const str = data.toString();
      try {
        const raw = JSON.parse(str);
        if (raw.type === "ping") {
          ws.send(JSON.stringify({ v: 1, type: "pong", payload: { timestamp: Date.now() }, requestId: raw.requestId }));
          return;
        }
      } catch {}

      try {
        const message = parseClientMessage(str);

        if (message.type === "join") {
          const side = message.payload.side as Side;
          const { room: roomCode, resumeToken } = message.payload;

          const session = store.validateToken(roomCode, side, resumeToken);
          boundRoomCode = session.room;
          boundSide = side;

          recovery.handleReconnect(session, side, ws, message.requestId);
          return;
        }

        if (!boundRoomCode || !boundSide) {
          ws.send(JSON.stringify(createServerMessage("error", {
            code: "UNAUTHORIZED",
            message: "Must send valid join event first",
          })));
          return;
        }

        const session = store.getSession(boundRoomCode);
        if (!session) {
          ws.send(JSON.stringify(createServerMessage("error", {
            code: "SESSION_UNAVAILABLE",
            message: "Room not found or expired",
          })));
          ws.close();
          return;
        }

        if (message.type === "start_recording") {
          audioReceiver.startRecording(session, boundSide, message.payload, message.requestId);
          return;
        }

        if (message.type === "stop_recording") {
          await audioReceiver.stopRecording(session, boundSide, message.requestId);
          return;
        }

        if (message.type === "cancel_recording") {
          audioReceiver.cancelRecording(session, boundSide, message.requestId);
          return;
        }

        if (message.type === "confirm_transcript") {
          const { text, consent } = message.payload;
          const { isFirstConfirmation } = store.confirmParticipant(session, boundSide, text, consent);

          if (isFirstConfirmation) {
            broadcast(session, "side_ready", { side: boundSide });

            if (session.confirmedRevision.A === 1 && session.confirmedRevision.B === 1) {
              broadcast(session, "both_ready", {});
            }

            // Trigger orchestrator pipeline asynchronously
            orchestrator.onSideConfirmed(session, boundSide).catch(() => {});
          }
          return;
        }

        if (message.type === "start_typed_input") {
          audioReceiver.cancelRecording(session, boundSide);
          transitionParticipant(session, boundSide, "REVIEW");
          session.transcripts[boundSide] = "";
          sendToSide(session, boundSide, "final_transcript", { text: "" }, message.requestId);
          return;
        }

        if (message.type === "replay_audio") {
          recovery.replayCachedOutput(session, boundSide, ws);
          return;
        }
      } catch (err: any) {
        ws.send(JSON.stringify(createServerMessage("error", sanitizeError(err))));
      }
    });

    ws.on("close", () => {
      if (boundRoomCode && boundSide) {
        audioReceiver.cleanupRecording(boundRoomCode, boundSide);
        const session = store.getSession(boundRoomCode);
        if (session) {
          lifecycle.handleDisconnect(session, boundSide);
        }
      }
    });
  });

  return {
    server,
    wss,
    store,
    lifecycle,
    recovery,
    orchestrator,
    audioReceiver,
    sttProvider,
    start: () =>
      new Promise<void>((resolve) => {
        server.listen(config.port, config.host, () => {
          resolve();
        });
      }),
    close: () =>
      new Promise<void>((resolve, reject) => {
        lifecycle.disposeAll();
        wss.close(() => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
      }),
  };
}
