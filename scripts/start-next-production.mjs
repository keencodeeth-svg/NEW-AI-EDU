import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const cwd = process.cwd();
const args = process.argv.slice(2);
const env = { ...process.env };
const forwardedArgs = [];
const originalEnvKeys = new Set(Object.keys(process.env));

function parseEnvFile(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const parsed = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    value = value.replace(/\\n/g, "\n");
    parsed.push([key, value]);
  }
  return parsed;
}

function loadStandaloneEnv(targetEnv) {
  const nodeEnv = targetEnv.NODE_ENV ?? "production";
  const candidateFiles = [
    ".env",
    `.env.${nodeEnv}`,
    ".env.local",
    `.env.${nodeEnv}.local`,
  ];
  for (const fileName of candidateFiles) {
    const filePath = path.join(cwd, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    for (const [key, value] of parseEnvFile(filePath)) {
      if (originalEnvKeys.has(key)) {
        continue;
      }
      targetEnv[key] = value;
    }
  }
}

function normalizeStandalonePathEnv(targetEnv, key, fallbackPath) {
  const resolvedValue = targetEnv[key] ?? fallbackPath;
  targetEnv[key] = path.isAbsolute(resolvedValue) ? resolvedValue : path.resolve(cwd, resolvedValue);
}

function ensureStandaloneAssetMount(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return;
  }
  try {
    const stats = fs.lstatSync(targetPath);
    if (stats.isSymbolicLink()) {
      try {
        fs.realpathSync(targetPath);
        return;
      } catch {
        fs.rmSync(targetPath, { force: true, recursive: true });
      }
    } else {
      return;
    }
  } catch {
    // Target path does not exist yet; fall through and create it.
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  try {
    fs.symlinkSync(sourcePath, targetPath, "dir");
  } catch {
    fs.cpSync(sourcePath, targetPath, { recursive: true });
  }
}

for (let index = 0; index < args.length; index += 1) {
  const value = args[index];
  if ((value === "--hostname" || value === "-H") && args[index + 1]) {
    env.HOSTNAME = args[index + 1];
    index += 1;
    continue;
  }
  if ((value === "--port" || value === "-p") && args[index + 1]) {
    env.PORT = args[index + 1];
    index += 1;
    continue;
  }
  forwardedArgs.push(value);
}

const standaloneServerCandidates = [
  {
    mode: "nested",
    serverPath: path.join(cwd, ".next", "standalone", "server.js"),
  },
  {
    mode: "root",
    serverPath: path.join(cwd, "server.js"),
  },
];

const activeStandaloneBuild =
  standaloneServerCandidates.find((candidate) => fs.existsSync(candidate.serverPath)) ?? null;
const standaloneServer = activeStandaloneBuild?.serverPath ?? "";
const hasStandaloneBuild = activeStandaloneBuild !== null;

if (hasStandaloneBuild) {
  loadStandaloneEnv(env);
  normalizeStandalonePathEnv(env, "DATA_DIR", path.join(cwd, ".runtime-data"));
  normalizeStandalonePathEnv(env, "DATA_SEED_DIR", path.join(cwd, "data"));
  normalizeStandalonePathEnv(env, "OBJECT_STORAGE_ROOT", path.join(cwd, ".runtime-data", "objects"));

  if (activeStandaloneBuild?.mode === "nested") {
    ensureStandaloneAssetMount(
      path.join(cwd, ".next", "static"),
      path.join(cwd, ".next", "standalone", ".next", "static")
    );
    ensureStandaloneAssetMount(path.join(cwd, "public"), path.join(cwd, ".next", "standalone", "public"));
  }
}

const command = hasStandaloneBuild
  ? process.execPath
  : path.join(cwd, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");

const commandArgs = hasStandaloneBuild ? [standaloneServer] : ["start", ...args];

if (hasStandaloneBuild && forwardedArgs.length > 0) {
  console.warn(
    `Ignoring unsupported standalone start arguments: ${forwardedArgs.join(" ")}`
  );
}

const child = spawn(command, commandArgs, {
  cwd,
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
