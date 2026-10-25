import { loadConfig } from "./config.js";
import { createGatewayServer } from "./server.js";

const config = loadConfig();
const gateway = createGatewayServer(config);

gateway.start().then(() => {
  console.log(`[ZoomOut Gateway] Running at http://${config.host}:${config.port} (mode: ${config.providerMode})`);
  console.log(`[ZoomOut Gateway] WebSocket endpoint: ws://${config.host}:${config.port}/ws`);
  console.log(`[ZoomOut Gateway] Allowed origins: ${config.allowedOrigins.join(", ")}`);
}).catch((err) => {
  console.error("[ZoomOut Gateway] Failed to start:", err);
  process.exit(1);
});
