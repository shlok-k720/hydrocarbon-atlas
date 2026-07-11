import { spawnSync } from "node:child_process";

const rawArgs = process.argv.slice(2);
const isRender =
  process.env.RENDER === "true" || Boolean(process.env.RENDER_SERVICE_ID);
const isCi = process.env.CI === "true";
const useDeployMode = isRender || isCi;

function stripDevOnlyArgs(args) {
  const filteredArgs = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--name") {
      index += 1;
      continue;
    }

    if (arg.startsWith("--name=")) {
      continue;
    }

    filteredArgs.push(arg);
  }

  return filteredArgs;
}

const prismaArgs = useDeployMode
  ? ["prisma", "migrate", "deploy", ...stripDevOnlyArgs(rawArgs)]
  : ["prisma", "migrate", "dev", ...rawArgs];

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, prismaArgs, {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);