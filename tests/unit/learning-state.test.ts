import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

type LearningStateModule = typeof import("../../lib/learning-state");

const MODULE_TARGETS = [
  "../../lib/learning-state",
  "../../lib/classes",
  "../../lib/content",
  "../../lib/mastery",
  "../../lib/db",
  "../../lib/storage"
] as const;

function resetModules() {
  for (const target of MODULE_TARGETS) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // Ignore cache misses during isolated test runs.
    }
  }
}

function loadLearningStateModule(stubs: Record<string, Record<string, unknown>> = {}) {
  resetModules();

  const classes = require("../../lib/classes") as Record<string, unknown>;
  const content = require("../../lib/content") as Record<string, unknown>;
  const mastery = require("../../lib/mastery") as Record<string, unknown>;
  const db = require("../../lib/db") as Record<string, unknown>;
  const storage = require("../../lib/storage") as Record<string, unknown>;

  Object.assign(classes, {
    getClassStudentIds: async () => [],
    getStudentsByClass: async () => []
  });
  Object.assign(content, {
    getQuestions: async () => [],
    updateQuestion: async () => null
  });
  Object.assign(mastery, {
    getMasteryRecordsByUser: async () => []
  });
  Object.assign(db, {
    isDbEnabled: () => false,
    query: async () => [],
    queryOne: async () => null
  });
  Object.assign(storage, {
    readJson: () => [],
    updateJson: async (_file: string, seed: unknown[], updater: (items: unknown[]) => void) => {
      const draft = [...seed];
      updater(draft);
    }
  });

  for (const [moduleName, overrides] of Object.entries(stubs)) {
    const target =
      moduleName === "classes"
        ? classes
        : moduleName === "content"
          ? content
          : moduleName === "mastery"
            ? mastery
            : moduleName === "db"
              ? db
              : storage;
    Object.assign(target, overrides);
  }

  return require("../../lib/learning-state") as LearningStateModule;
}

afterEach(() => {
  resetModules();
});

test("buildMoodTrendSummary aggregates counts, latest mood and recent seven-day trend", () => {
  const learningState = loadLearningStateModule();

  const summary = learningState.buildMoodTrendSummary([
    {
      id: "mood-1",
      userId: "stu-1",
      mood: "neutral",
      createdAt: "2026-04-01T08:00:00.000Z"
    },
    {
      id: "mood-2",
      userId: "stu-1",
      mood: "good",
      createdAt: "2026-04-03T08:00:00.000Z"
    },
    {
      id: "mood-3",
      userId: "stu-1",
      mood: "tired",
      createdAt: "2026-03-28T08:00:00.000Z"
    },
    {
      id: "mood-4",
      userId: "stu-1",
      mood: "good",
      createdAt: "2026-04-03T12:00:00.000Z"
    },
    {
      id: "mood-5",
      userId: "stu-1",
      mood: "good",
      createdAt: "2026-03-26T08:00:00.000Z"
    }
  ]);

  assert.equal(summary.total, 5);
  assert.equal(summary.latestMood, "good");
  assert.deepEqual(summary.counts, {
    good: 3,
    neutral: 1,
    tired: 1
  });
  assert.deepEqual(
    summary.trend.map((item) => item.date),
    ["2026-03-26", "2026-03-28", "2026-04-01", "2026-04-03"]
  );
  assert.equal(summary.trend.at(-1)?.good, 2);
});

test("isBreakSuggestionNeeded only triggers after 25 minutes and respects dismissal", () => {
  const learningState = loadLearningStateModule();
  const sessionStartedAt = Date.UTC(2026, 3, 4, 0, 0, 0);

  assert.equal(
    learningState.isBreakSuggestionNeeded({
      sessionStartedAt,
      suggestionDismissed: false,
      now: sessionStartedAt + 24 * 60 * 1000
    }),
    false
  );
  assert.equal(
    learningState.isBreakSuggestionNeeded({
      sessionStartedAt,
      suggestionDismissed: false,
      now: sessionStartedAt + 25 * 60 * 1000
    }),
    true
  );
  assert.equal(
    learningState.isBreakSuggestionNeeded({
      sessionStartedAt,
      suggestionDismissed: true,
      now: sessionStartedAt + 40 * 60 * 1000
    }),
    false
  );
});

test("getRecoveryQuestion prefers easy questions from mastered knowledge points and marks them as recovery", async () => {
  const learningState = loadLearningStateModule({
    content: {
      getQuestions: async () => [
        {
          id: "q-hard",
          subject: "math",
          grade: "4",
          knowledgePointId: "kp-mastered",
          difficulty: "hard"
        },
        {
          id: "q-easy-mastered",
          subject: "math",
          grade: "4",
          knowledgePointId: "kp-mastered",
          difficulty: "easy"
        },
        {
          id: "q-easy-other",
          subject: "math",
          grade: "4",
          knowledgePointId: "kp-other",
          difficulty: "easy"
        }
      ]
    },
    mastery: {
      getMasteryRecordsByUser: async () => [
        { knowledgePointId: "kp-mastered", masteryScore: 92 },
        { knowledgePointId: "kp-other", masteryScore: 88 }
      ]
    }
  });

  const recovery = await learningState.getRecoveryQuestion({
    userId: "stu-1",
    subject: "math",
    grade: "4",
    knowledgePointId: "kp-mastered",
    excludeQuestionId: "q-hard"
  });

  assert.equal(recovery?.id, "q-easy-mastered");
  assert.equal(recovery?.isRecovery, true);
});

test("saveStudentMoodCheckin trims file-backed input before persisting", async () => {
  const saved: Array<Record<string, unknown>> = [];
  const learningState = loadLearningStateModule({
    storage: {
      readJson: () => saved,
      updateJson: async (_file: string, seed: unknown[], updater: (items: unknown[]) => void) => {
        const draft = saved.length ? [...saved] : [...seed];
        updater(draft);
        saved.splice(0, saved.length, ...(draft as Array<Record<string, unknown>>));
      }
    }
  });

  const record = await learningState.saveStudentMoodCheckin({
    userId: "stu-1",
    mood: "good",
    context: "  今天状态很好  "
  });

  assert.equal(record.userId, "stu-1");
  assert.equal(record.context, "今天状态很好");
  assert.equal(saved.length, 1);
  assert.equal(saved[0]?.mood, "good");
});

test("student mood checkins fall back to file storage when the database table is missing", async () => {
  const saved: Array<Record<string, unknown>> = [];
  const missingRelation = new Error('relation "student_mood_checkins" does not exist');
  const learningState = loadLearningStateModule({
    db: {
      isDbEnabled: () => true,
      query: async () => {
        throw missingRelation;
      },
      queryOne: async () => {
        throw missingRelation;
      }
    },
    storage: {
      readJson: () => saved,
      updateJson: async (_file: string, seed: unknown[], updater: (items: unknown[]) => void) => {
        const draft = saved.length ? [...saved] : [...seed];
        updater(draft);
        saved.splice(0, saved.length, ...(draft as Array<Record<string, unknown>>));
      }
    }
  });

  const created = await learningState.saveStudentMoodCheckin({
    userId: "stu-db-fallback",
    mood: "neutral",
    context: "  课前有点紧张  "
  });
  const listed = await learningState.getStudentMoodCheckins("stu-db-fallback");

  assert.equal(created.context, "课前有点紧张");
  assert.equal(saved.length, 1);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.userId, "stu-db-fallback");
  assert.equal(listed[0]?.mood, "neutral");
});
