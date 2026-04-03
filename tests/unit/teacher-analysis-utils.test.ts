import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

const Module = require("node:module") as {
  _resolveFilename: (request: string, parent?: unknown, isMain?: boolean, options?: unknown) => string;
};

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "@/lib/client-request") {
    return path.resolve(__dirname, "../../lib/client-request.js");
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const {
  getTeacherAnalysisAlertRequestMessage,
  getTeacherAnalysisClassRequestMessage,
  getTeacherAnalysisFavoritesRequestMessage,
  getTeacherAnalysisRequestMessage,
  isMissingTeacherAnalysisAlertError,
  isMissingTeacherAnalysisClassError,
  removeTeacherAnalysisAlertImpact,
  removeTeacherAnalysisClassSnapshot,
  resolveTeacherAnalysisClassId,
  resolveTeacherAnalysisStudentId
} = require("../../app/teacher/analysis/utils") as typeof import("../../app/teacher/analysis/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("teacher analysis helpers map auth and alert validation errors", () => {
  assert.equal(
    getTeacherAnalysisRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "教师登录状态已失效，请重新登录后继续查看分析看板。"
  );
  assert.equal(
    getTeacherAnalysisRequestMessage(createRequestError(400, "invalid alert id"), "fallback"),
    "当前预警标识无效，请刷新列表后重试。"
  );
  assert.equal(
    getTeacherAnalysisRequestMessage(createRequestError(400, "invalid actionType"), "fallback"),
    "当前预警动作不可用，请刷新列表后重试。"
  );
  assert.equal(
    getTeacherAnalysisRequestMessage(createRequestError(400, "alert has no target students"), "fallback"),
    "该预警当前没有可执行的学生对象，建议刷新列表后重试。"
  );
});

test("teacher analysis helpers distinguish stale class, alert, and favorite contexts", () => {
  assert.equal(
    getTeacherAnalysisClassRequestMessage(createRequestError(404, "not found"), "fallback"),
    "当前班级不存在，或你已失去访问权限。"
  );
  assert.equal(
    getTeacherAnalysisFavoritesRequestMessage(createRequestError(404, "not found"), "fallback"),
    "该学生已不在当前班级中，暂时无法查看收藏。"
  );
  assert.equal(
    getTeacherAnalysisAlertRequestMessage(createRequestError(404, "not found"), "fallback"),
    "该预警已不存在，列表将按最新状态刷新。"
  );
  assert.equal(isMissingTeacherAnalysisClassError(createRequestError(404, "not found")), true);
  assert.equal(isMissingTeacherAnalysisAlertError(createRequestError(404, "not found")), true);
  assert.equal(isMissingTeacherAnalysisAlertError(createRequestError(400, "invalid alert id")), true);
  assert.equal(isMissingTeacherAnalysisClassError(createRequestError(400, "bad request")), false);
});

test("teacher analysis helpers resolve selection fallbacks and clear stale snapshots", () => {
  assert.equal(
    resolveTeacherAnalysisClassId("class-b", [{ id: "class-a" }, { id: "class-b" }]),
    "class-b"
  );
  assert.equal(
    resolveTeacherAnalysisClassId("missing", [{ id: "class-a" }, { id: "class-b" }]),
    "class-a"
  );
  assert.equal(
    resolveTeacherAnalysisStudentId("student-b", [{ id: "student-a" }, { id: "student-b" }]),
    "student-b"
  );
  assert.equal(
    resolveTeacherAnalysisStudentId(
      "student-b",
      [{ id: "student-a" }, { id: "student-b" }],
      "student-a"
    ),
    "student-a"
  );
  assert.deepEqual(
    removeTeacherAnalysisClassSnapshot(
      [{ id: "class-a" }, { id: "class-b" }],
      "class-a"
    ),
    {
      classes: [{ id: "class-b" }],
      classId: "class-b"
    }
  );
});

test("teacher analysis helpers remove cached alert impact deterministically", () => {
  const impactMap = {
    "alert-1": {
      alertId: "alert-1",
      impact: {
        tracked: true,
        actionId: "action-1",
        trackedAt: "2026-03-19T00:00:00.000Z",
        elapsedHours: 24,
        deltas: {
          riskScore: -2,
          metricDeltas: {}
        },
        windows: {
          h24: {
            hours: 24,
            ready: true,
            dueAt: "2026-03-20T00:00:00.000Z",
            remainingHours: 0,
            riskDelta: -2,
            riskDeltaRate: -0.1,
            improved: true
          },
          h72: {
            hours: 72,
            ready: false,
            dueAt: "2026-03-22T00:00:00.000Z",
            remainingHours: 48,
            riskDelta: null,
            riskDeltaRate: null,
            improved: null
          }
        }
      }
    }
  };

  assert.deepEqual(removeTeacherAnalysisAlertImpact(impactMap, "alert-1"), {});
  assert.equal(removeTeacherAnalysisAlertImpact(impactMap, "missing"), impactMap);
});
