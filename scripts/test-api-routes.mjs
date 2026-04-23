import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertApiTestBuildFreshness } from "./api-test/build-freshness.mjs";
import { resolveApiTestPort } from "./api-test/runtime-port.mjs";
import { createRuntime } from "./api-test/runtime.mjs";
import { runAdminContentSuite } from "./api-test/suites/admin-content.mjs";
import { runCoreAuthSuite } from "./api-test/suites/core-auth.mjs";
import { runLearningSuite } from "./api-test/suites/learning.mjs";
import { runSchoolScheduleSuite } from "./api-test/suites/school-schedules.mjs";
import { runSmokeSuite } from "./api-test/suites/smoke.mjs";
import { runTeacherExamSuite } from "./api-test/suites/teacher-exam.mjs";

const requestedPort = Number(process.env.API_TEST_PORT || 3210);
const port = await resolveApiTestPort({
  preferredPort: requestedPort,
  explicitPort: Boolean(process.env.API_TEST_PORT?.trim()),
});
const runtime = createRuntime(port);
const SNAPSHOT_DIRS = ["data", ".runtime-data"];
const traceEnabled = process.env.API_TEST_TRACE === "true";

function traceStep(message) {
  if (!traceEnabled) return;
  console.error(`[api-test] ${message}`);
}

function createMutableStateSnapshot() {
  const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hk-ai-edu-api-test-"));

  for (const directory of SNAPSHOT_DIRS) {
    const sourcePath = path.join(process.cwd(), directory);
    const targetPath = path.join(snapshotRoot, directory);
    if (fs.existsSync(sourcePath)) {
      fs.cpSync(sourcePath, targetPath, { recursive: true });
    }
  }

  return () => {
    for (const directory of SNAPSHOT_DIRS) {
      const sourcePath = path.join(snapshotRoot, directory);
      const targetPath = path.join(process.cwd(), directory);
      fs.rmSync(targetPath, { recursive: true, force: true });
      if (fs.existsSync(sourcePath)) {
        fs.cpSync(sourcePath, targetPath, { recursive: true });
      }
    }
    fs.rmSync(snapshotRoot, { recursive: true, force: true });
  };
}

async function run() {
  const remoteSelfTest = process.env.API_TEST_REMOTE_SELF_TEST === "true";
  const scope = (process.env.API_TEST_SUITE ?? process.env.API_TEST_SCOPE ?? "full").toLowerCase();
  const requestedMode = process.env.API_TEST_SERVER_MODE;
  const isStartMode = requestedMode === "start";
  const restoreMutableState = runtime.isRemote ? () => {} : createMutableStateSnapshot();

  if (
    !runtime.isRemote &&
    isStartMode &&
    process.env.API_TEST_SKIP_BUILD_FRESHNESS_CHECK !== "true"
  ) {
    assertApiTestBuildFreshness(process.cwd());
  }

  const { server, getServerLog } = runtime.startServer();
  let activeRuntime = runtime;

  if (runtime.isRemote && scope !== "smoke" && scope !== "health" && process.env.API_TEST_ALLOW_REMOTE_FULL !== "true") {
    throw new Error(
      `Remote API test mode only allows smoke/health by default. Received API_TEST_SCOPE=${scope}. Set API_TEST_ALLOW_REMOTE_FULL=true to override intentionally.`
    );
  }

  if (remoteSelfTest && scope !== "smoke" && scope !== "health") {
    throw new Error(`API_TEST_REMOTE_SELF_TEST only supports smoke/health scope. Received API_TEST_SCOPE=${scope}.`);
  }

  const state = {
    email: "",
    password: "",
    observerCode: "",
    parentEmail: "",
    parentPassword: "",
    createdExamId: null,
    createdKnowledgePointId: null,
    createdQuestionId: null,
    createdQuestionIds: new Set()
  };
  let failure = null;

  try {
    traceStep(`waiting for server readiness (${runtime.baseUrl})`);
    await runtime.waitForServerReady();
    traceStep("server ready");

    if (remoteSelfTest) {
      process.env.API_TEST_BASE_URL = runtime.baseUrl;
      activeRuntime = createRuntime(port);
      traceStep("waiting for remote self-test readiness");
      await activeRuntime.waitForServerReady();
      traceStep("remote self-test ready");
    }

    const context = {
      ...activeRuntime,
      state
    };

    if (scope === "health") {
      traceStep("running health scope");
      const health = await activeRuntime.apiFetch("/api/health", { useCookies: false });
      if (health.status !== 200) {
        throw new Error(`Health liveness failed: ${health.status} ${health.raw}`);
      }
      const readiness = await activeRuntime.apiFetch("/api/health/readiness", { useCookies: false });
      if (readiness.status !== 200) {
        throw new Error(`Health readiness failed: ${readiness.status} ${readiness.raw}`);
      }
      console.log("API health tests passed.");
      return;
    }

    if (scope === "smoke") {
      traceStep("running smoke suite");
      await runSmokeSuite(context);
      console.log("API smoke tests passed.");
      return;
    }
    if (scope === "school-schedules") {
      traceStep("running school schedules suite");
      await runSchoolScheduleSuite(context);
      console.log("School schedule API regression tests passed.");
      return;
    }
    traceStep("running core auth suite");
    await runCoreAuthSuite(context);
    traceStep("running learning suite");
    await runLearningSuite(context);
    traceStep("running teacher exam suite");
    await runTeacherExamSuite(context);
    traceStep("running admin content suite");
    await runAdminContentSuite(context);

    console.log("API integration tests passed.");
  } catch (error) {
    failure =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" && error.trim() ? error : "API integration tests failed");
  } finally {
    traceStep("starting cleanup");
    for (const questionId of state.createdQuestionIds) {
      try {
        await activeRuntime.apiFetch(`/api/admin/questions/${questionId}`, { method: "DELETE" });
      } catch {
        // cleanup best effort
      }
    }

    try {
      if (state.createdKnowledgePointId) {
        await activeRuntime.apiFetch(`/api/admin/knowledge-points/${state.createdKnowledgePointId}`, { method: "DELETE" });
      }
    } catch {
      // cleanup best effort
    }

    traceStep("stopping server");
    await runtime.stopServer(server);
    traceStep("server stopped");
    if (remoteSelfTest) {
      delete process.env.API_TEST_BASE_URL;
    }
    restoreMutableState();
    traceStep("cleanup finished");
  }

  if (failure) {
    console.error("API integration tests failed.");
    const serverLog = getServerLog();
    if (serverLog.trim()) {
      console.error("--- server log ---");
      console.error(serverLog.slice(-8000));
      console.error("--- end server log ---");
    }
    throw failure;
  }
}

const keepAlive = setInterval(() => {}, 1000);

run()
  .then(() => {
    clearInterval(keepAlive);
    process.exit(0);
  })
  .catch((error) => {
    clearInterval(keepAlive);
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exit(1);
  });
