import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { ServerConfig, isOriginAllowed } from "./config.js";

export function createGatewayServer(config: ServerConfig) {
  const wss = new WebSocketServer({ noServer: true });

  const server = http.createServer((req, res) => {
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
    ws.on("message", (data: Buffer | string, isBinary: boolean) => {
      if (isBinary) {
        return;
      }
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === "ping") {
          ws.send(JSON.stringify({ v: 1, type: "pong", payload: { timestamp: Date.now() }, requestId: parsed.requestId }));
        }
      } catch {
        ws.send(JSON.stringify({ v: 1, type: "error", payload: { code: "BAD_EVENT", message: "Malformed JSON" } }));
      }
    });
  });

  return {
    server,
    wss,
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
