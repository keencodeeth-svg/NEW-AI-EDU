import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const cwd = process.cwd();
const args = process.argv.slice(2);

function removeIfExists(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }
  fs.rmSync(targetPath, { recursive: true, force: true });
}

// `scripts/start-next-production.mjs` mounts runtime assets into the standalone
// output so local production-like smoke can boot without copying everything.
// Those mounts can survive between runs and make the next `next build` fail
// while trying to clean `.next/standalone/.next`.
removeIfExists(path.join(cwd, ".next", "standalone", ".next"));
removeIfExists(path.join(cwd, ".next", "standalone", "public"));

const nextBin = path.join(
  cwd,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next"
);

const child = spawn(nextBin, ["build", ...args], {
  cwd,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
