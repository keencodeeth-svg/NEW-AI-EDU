import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, "scripts", "launch-readiness-report.mjs");
const tempRoots: string[] = [];

function createTempCwd() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "launch-readiness-script-"));
  tempRoots.push(cwd);
  return cwd;
}

function runLaunchReadiness(args: string[], env: Record<string, string | undefined> = {}) {
  const cwd = createTempCwd();
  const childEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? "",
    NODE_ENV: "test",
    NODE_PATH: path.join(repoRoot, "node_modules"),
    ...env
  };
  return spawnSync(process.execPath, [scriptPath, "--json", ...args], {
    cwd,
    env: childEnv,
    encoding: "utf8"
  });
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("launch readiness --strict forces strict launch mode independent of NODE_ENV", () => {
  const result = runLaunchReadiness(["--strict"], {
    NODE_ENV: "development"
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.strictLaunchMode, true);
  assert.equal(report.overallState, "fail");
  assert.equal(report.runtimeChecks.some((check: { key: string; state: string }) => check.key === "database" && check.state === "fail"), true);
});

test("LAUNCH_READINESS_STRICT=1 forces strict launch mode", () => {
  const result = runLaunchReadiness([], {
    NODE_ENV: "development",
    LAUNCH_READINESS_STRICT: "1"
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.strictLaunchMode, true);
});
