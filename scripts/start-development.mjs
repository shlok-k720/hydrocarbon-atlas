import { spawn } from "node:child_process";
import { ensureDatabase } from "./ensure-database.mjs";

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

function startDevServer() {
  const child = spawn(npxCommand, ["next", "dev"], {
    stdio: "inherit",
    env: process.env,
  });

  ["SIGINT", "SIGTERM"].forEach((signal) => {
    process.on(signal, () => {
      child.kill(signal);
    });
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

ensureDatabase();
startDevServer();