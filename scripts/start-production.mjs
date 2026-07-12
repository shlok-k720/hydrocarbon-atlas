import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { ensureDatabase } from "./ensure-database.mjs";

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

function runBuildIfMissing() {
  if (existsSync(".next/BUILD_ID")) {
    return;
  }

  console.warn("No production build found in .next. Running next build before starting.");

  const result = spawnSync(npxCommand, ["next", "build"], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function startServer() {
  const child = spawn(npxCommand, ["next", "start"], {
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
runBuildIfMissing();
startServer();