import { spawn } from "node:child_process";

const api = spawn("npm", ["run", "dev", "--workspace=@zoomout/api"], {
  stdio: "inherit",
  shell: true,
});

const frontend = spawn("npm", ["run", "dev", "--workspace=@zoomout/frontend"], {
  stdio: "inherit",
  shell: true,
});

function shutdown() {
  api.kill();
  frontend.kill();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
