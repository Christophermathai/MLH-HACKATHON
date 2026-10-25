import http from "node:http";
import crypto from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import {
  LIMITS,
  Side,
  ParticipantState,
  SessionState,
  parseClientMessage,
  createServerMessage,
  sanitizeError,
  SessionSnapshot,
  ClaimParticipantRequestSchema,
  ZoomOutPublicError,
  MediatorResult,
  SafetyResult,
  AudioManifest,
  Outcome,
} from "@zoomout/contracts";
import { ServerConfig, isOriginAllowed } from "./config.js";
import {
  PipelineProviders,
  OrchestratedRoom,
  runOrchestrationPipeline,
} from "./sessions/orchestrator.js";
import {
  FakeAnalystProvider,
  FakeMediatorProvider,
  FakeJudgeStreamProvider,
  FakeTtsProvider,
} from "./providers/fakeProviders.js";
import { OpenAiLlmProvider } from "./providers/openaiLlm.js";
import { ElevenLabsTtsProvider } from "./providers/elevenlabsTts.js";

export interface RoomData extends OrchestratedRoom {
  room: string;
  tokens: { A: string; B: string | null };
  createdAt: number;
  expiresAt: string;
  states: { A: ParticipantState; B: ParticipantState };
  transcripts: { A: string | null; B: string | null };
  confirmed: { A: boolean; B: boolean };
  consent: { A: boolean; B: boolean };
  sessionState: SessionState;
  generationId: string | null;
  sharedResult: MediatorResult | null;
  verdictText: string | null;
  safetyResult: SafetyResult | null;
  outcome: Outcome | null;
  audioManifest: AudioManifest | null;
  audioChunks: Map<number, { seq: number; mime: string; data: string }>;
  sockets: { A: WebSocket | null; B: WebSocket | null };
}

function generateRoomCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

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

export function createGatewayServer(
  config: ServerConfig,
  customProviders?: Partial<PipelineProviders>
) {
  const wss = new WebSocketServer({ noServer: true });
  const rooms = new Map<string, RoomData>();

  // Initialize pipeline providers based on mode or overrides
  const isLive = config.providerMode === "live";
  const openaiProvider = isLive && config.openaiApiKey ? new OpenAiLlmProvider({ apiKey: config.openaiApiKey }) : null;
  const elevenlabsTts = isLive && config.elevenlabsApiKey ? new ElevenLabsTtsProvider({ apiKey: config.elevenlabsApiKey, voiceId: config.elevenlabsVoiceId }) : null;

  const providers: PipelineProviders = {
    analyst: customProviders?.analyst ?? openaiProvider ?? new FakeAnalystProvider(),
    mediator: customProviders?.mediator ?? openaiProvider ?? new FakeMediatorProvider(),
    judge: customProviders?.judge ?? openaiProvider ?? new FakeJudgeStreamProvider(),
    tts: customProviders?.tts ?? elevenlabsTts ?? new FakeTtsProvider(),
  };

  function getSnapshot(room: RoomData, side: Side): SessionSnapshot {
    return {
      room: room.room,
      side,
      expiresAt: room.expiresAt,
      ownState: room.states[side],
      ownText: room.transcripts[side],
      ownConfirmed: room.confirmed[side],
      ownConsent: room.consent[side],
      readiness: {
        A: room.confirmed.A && room.consent.A,
        B: room.confirmed.B && room.consent.B,
      },
      sessionState: room.sessionState,
      generationId: room.generationId,
      sharedResult: room.sharedResult,
      verdictText: room.verdictText,
      outcome: room.outcome,
      audioManifest: room.audioManifest,
    };
  }

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
      if (rooms.size >= LIMITS.MAX_ACTIVE_ROOMS) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ code: "CAPACITY", message: "Server room capacity reached" }));
        return;
      }

      const roomCode = generateRoomCode();
      const tokenA = generateToken();
      const now = Date.now();
      const expiresAt = new Date(now + LIMITS.SESSION_LIFETIME_MS).toISOString();

      const newRoom: RoomData = {
        room: roomCode,
        tokens: { A: tokenA, B: null },
        createdAt: now,
        expiresAt,
        states: { A: "IDLE", B: "IDLE" },
        transcripts: { A: null, B: null },
        confirmed: { A: false, B: false },
        consent: { A: false, B: false },
        sessionState: "CREATED",
        generationId: null,
        sharedResult: null,
        verdictText: null,
        safetyResult: null,
        outcome: null,
        audioManifest: null,
        audioChunks: new Map(),
        sockets: { A: null, B: null },
      };

      rooms.set(roomCode, newRoom);

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          room: roomCode,
          side: "A",
          resumeToken: tokenA,
          expiresAt,
        })
      );
      return;
    }

    // POST /api/rooms/:room/participants
    const participantMatch = url.pathname.match(/^\/api\/rooms\/([a-zA-Z0-9]{8})\/participants$/);
    if (req.method === "POST" && participantMatch) {
      const roomCode = participantMatch[1].toUpperCase();
      const room = rooms.get(roomCode);

      if (!room || Date.now() > room.createdAt + LIMITS.SESSION_LIFETIME_MS) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ code: "SESSION_UNAVAILABLE", message: "Room not found or expired" }));
        return;
      }

      try {
        const body = await readJsonBody(req);
        const parsed = ClaimParticipantRequestSchema.safeParse(body);
        if (!parsed.success || parsed.data.side !== "B") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ code: "BAD_EVENT", message: "Only side B can be claimed" }));
          return;
        }

        if (room.tokens.B !== null) {
          res.writeHead(409, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ code: "SIDE_TAKEN", message: "Side B has already been claimed for this room." }));
          return;
        }

        const tokenB = generateToken();
        room.tokens.B = tokenB;

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            room: roomCode,
            side: "B",
            resumeToken: tokenB,
            expiresAt: room.expiresAt,
          })
        );
        return;
      } catch (err: any) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify(sanitizeError(err)));
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
    let boundRoom: RoomData | null = null;
    let boundSide: Side | null = null;

    ws.on("message", (data: Buffer | string, isBinary: boolean) => {
      if (isBinary) {
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
          const room = rooms.get(roomCode.toUpperCase());

          if (!room || Date.now() > room.createdAt + LIMITS.SESSION_LIFETIME_MS) {
            ws.send(JSON.stringify(createServerMessage("error", {
              code: "SESSION_UNAVAILABLE",
              message: "Room not found or expired",
            })));
            ws.close();
            return;
          }

          if (room.tokens[side] !== resumeToken) {
            ws.send(JSON.stringify(createServerMessage("error", {
              code: "UNAUTHORIZED",
              message: "Invalid resume token for this participant",
            })));
            ws.close();
            return;
          }

          // Replace old socket on reconnect
          if (room.sockets[side] && room.sockets[side] !== ws) {
            try {
              room.sockets[side]?.close();
            } catch {}
          }

          boundRoom = room;
          boundSide = side;
          room.sockets[side] = ws;

          // Send session snapshot
          const snapshot = getSnapshot(room, side);
          ws.send(JSON.stringify(createServerMessage("session_snapshot", snapshot, message.requestId)));
          return;
        }

        if (!boundRoom || !boundSide) {
          ws.send(JSON.stringify(createServerMessage("error", {
            code: "UNAUTHORIZED",
            message: "Must send valid join event first",
          })));
          return;
        }

        if (message.type === "confirm_transcript") {
          // If already confirmed and trying to change text, reject (FR-005-07)
          if (boundRoom.confirmed[boundSide]) {
            if (boundRoom.transcripts[boundSide] === message.payload.text) {
              // Idempotent repeat
              ws.send(JSON.stringify(createServerMessage("side_ready", { side: boundSide }, message.requestId)));
              return;
            }
            throw new ZoomOutPublicError("CONFIRMATION_LOCKED", "Transcript is locked for this session. Start a new room to change.");
          }

          const { text, consent } = message.payload;
          boundRoom.transcripts[boundSide] = text;
          boundRoom.confirmed[boundSide] = true;
          boundRoom.consent[boundSide] = consent;
          boundRoom.states[boundSide] = "READY";

          const sideReadyMsg = JSON.stringify(createServerMessage("side_ready", { side: boundSide }, message.requestId));
          boundRoom.sockets.A?.send(sideReadyMsg);
          boundRoom.sockets.B?.send(sideReadyMsg);

          if (boundRoom.confirmed.A && boundRoom.confirmed.B) {
            boundRoom.sessionState = "BOTH_READY";
            const bothReadyMsg = JSON.stringify(createServerMessage("both_ready", {}));
            boundRoom.sockets.A?.send(bothReadyMsg);
            boundRoom.sockets.B?.send(bothReadyMsg);

            // Execute pipeline asynchronously
            runOrchestrationPipeline(boundRoom, providers).catch((err) => {
              console.error("[ZoomOut Orchestrator] Pipeline failed:", err);
            });
          }
          return;
        }

        if (message.type === "start_typed_input") {
          boundRoom.states[boundSide] = "REVIEW";
          boundRoom.transcripts[boundSide] = "";
          ws.send(JSON.stringify(createServerMessage("final_transcript", { text: "" }, message.requestId)));
          return;
        }

        if (message.type === "replay_audio") {
          if (!boundRoom.audioManifest || boundRoom.audioChunks.size === 0) {
            ws.send(JSON.stringify(createServerMessage("error", {
              code: "INVALID_STATE",
              message: "No audio available to replay",
            }, message.requestId)));
            return;
          }

          // Send cached audio chunks in order without re-synthesizing
          const sortedSeqs = Array.from(boundRoom.audioChunks.keys()).sort((a, b) => a - b);
          for (const s of sortedSeqs) {
            const chunk = boundRoom.audioChunks.get(s)!;
            ws.send(JSON.stringify(createServerMessage("audio_chunk", {
              seq: chunk.seq,
              mime: chunk.mime,
              data: chunk.data,
              generationId: boundRoom.generationId ?? undefined,
            })));
          }
          ws.send(JSON.stringify(createServerMessage("audio_manifest", boundRoom.audioManifest)));
          ws.send(JSON.stringify(createServerMessage("done", {
            outcome: boundRoom.outcome ?? "verdict",
            generationId: boundRoom.generationId ?? undefined,
          }, message.requestId)));
          return;
        }
      } catch (err: any) {
        ws.send(JSON.stringify(createServerMessage("error", sanitizeError(err))));
      }
    });

    ws.on("close", () => {
      if (boundRoom && boundSide && boundRoom.sockets[boundSide] === ws) {
        boundRoom.sockets[boundSide] = null;
      }
    });
  });

  return {
    server,
    wss,
    rooms,
    start: () =>
      new Promise<void>((resolve) => {
        server.listen(config.port, config.host, () => {
          resolve();
        });
      }),
    close: () =>
      new Promise<void>((resolve, reject) => {
        wss.close(() => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
      }),
  };
}
