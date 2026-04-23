import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

type DifficultyCalibrationModule = typeof import("../../lib/difficulty-calibration");

const MODULE_TARGETS = ["../../lib/difficulty-calibration", "../../lib/progress", "../../lib/content"] as const;

function resetModules() {
  for (const target of MODULE_TARGETS) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // Ignore cache misses during isolated test runs.
    }
  }
}

function loadDifficultyCalibrationModule(stubs: Record<string, Record<string, unknown>> = {}) {
  resetModules();

  const progress = require("../../lib/progress") as Record<string, unknown>;
  const content = require("../../lib/content") as Record<string, unknown>;

  Object.assign(progress, {
    getAttempts: async () => []
  });
  Object.assign(content, {
    updateQuestion: async () => null
  });

  for (const [moduleName, overrides] of Object.entries(stubs)) {
    const target = moduleName === "progress" ? progress : content;
    Object.assign(target, overrides);
  }

  return require("../../lib/difficulty-calibration") as DifficultyCalibrationModule;
}

afterEach(() => {
  resetModules();
});

test("calculateActualDifficulty waits for enough attempts before calibrating", () => {
  const calibration = loadDifficultyCalibrationModule();

  const result = calibration.calculateActualDifficulty({
    correct: 8,
    total: 9,
    presetDifficulty: "easy"
  });

  assert.equal(result.calibrated, false);
  assert.equal(result.actualDifficulty, null);
  assert.equal(result.deviation, null);
  assert.equal(result.expectedDifficulty, 30);
});

test("calculateActualDifficulty derives actual difficulty and deviation from performance", () => {
  const calibration = loadDifficultyCalibrationModule();

  const result = calibration.calculateActualDifficulty({
    correct: 3,
    total: 12,
    presetDifficulty: "hard"
  });

  assert.equal(result.calibrated, true);
  assert.equal(result.actualDifficulty, 75);
  assert.equal(result.expectedDifficulty, 80);
  assert.equal(result.deviation, -5);
  assert.equal(result.correct, 3);
  assert.equal(result.total, 12);
});

test("recalibrateQuestionDifficulty persists calibrated difficulty after enough real attempts", async () => {
  let updated: { id: string; actualDifficulty?: number | null } | null = null;
  const calibration = loadDifficultyCalibrationModule({
    progress: {
      getAttempts: async () =>
        Array.from({ length: 12 }, (_, index) => ({
          id: `attempt-${index + 1}`,
          questionId: "q-calibrated",
          correct: index < 3
        }))
    },
    content: {
      updateQuestion: async (id: string, payload: { actualDifficulty?: number | null }) => {
        updated = { id, actualDifficulty: payload.actualDifficulty ?? null };
        return updated;
      }
    }
  });

  const result = await calibration.recalibrateQuestionDifficulty("q-calibrated", "hard");

  assert.equal(result.calibrated, true);
  assert.equal(result.actualDifficulty, 75);
  assert.deepEqual(updated, { id: "q-calibrated", actualDifficulty: 75 });
});

test("recalibrateQuestionDifficulty skips persistence when there is not enough data", async () => {
  let updateCalled = false;
  const calibration = loadDifficultyCalibrationModule({
    progress: {
      getAttempts: async () =>
        Array.from({ length: 5 }, (_, index) => ({
          id: `attempt-${index + 1}`,
          questionId: "q-early",
          correct: index % 2 === 0
        }))
    },
    content: {
      updateQuestion: async () => {
        updateCalled = true;
        return null;
      }
    }
  });

  const result = await calibration.recalibrateQuestionDifficulty("q-early", "medium");

  assert.equal(result.calibrated, false);
  assert.equal(result.actualDifficulty, null);
  assert.equal(updateCalled, false);
});
