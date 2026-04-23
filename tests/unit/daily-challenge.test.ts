import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

type DailyChallengeModule = typeof import("../../lib/daily-challenge");

const MODULE_TARGETS = [
  "../../lib/daily-challenge",
  "../../lib/storage",
  "../../lib/content",
  "../../lib/db",
  "../../lib/mastery",
  "../../lib/gamification",
] as const;

function resetModules() {
  for (const target of MODULE_TARGETS) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

function loadDailyChallengeModule(stubs: Record<string, Record<string, unknown>> = {}) {
  resetModules();

  const storage = require("../../lib/storage") as Record<string, unknown>;
  const content = require("../../lib/content") as Record<string, unknown>;
  const db = require("../../lib/db") as Record<string, unknown>;
  const mastery = require("../../lib/mastery") as Record<string, unknown>;
  const gamification = require("../../lib/gamification") as Record<string, unknown>;

  Object.assign(storage, {
    readJson: () => [],
    writeJson: () => {},
  });
  Object.assign(content, {
    getQuestions: async () => [],
  });
  Object.assign(db, {
    isDbEnabled: () => false,
    query: async () => [],
    queryOne: async () => null,
  });
  Object.assign(mastery, {
    getMasteryRecordsByUser: async () => [],
  });
  Object.assign(gamification, {
    addXp: async () => ({
      userId: "user-1",
      totalXp: 0,
      level: 1,
      rankTitle: "学习新星",
      updatedAt: "2026-04-04T00:00:00.000Z",
    }),
  });

  for (const [moduleName, overrides] of Object.entries(stubs)) {
    const target =
      moduleName === "storage"
        ? storage
        : moduleName === "content"
          ? content
          : moduleName === "db"
            ? db
            : moduleName === "mastery"
              ? mastery
              : gamification;
    Object.assign(target, overrides);
  }

  return require("../../lib/daily-challenge") as DailyChallengeModule;
}

afterEach(() => {
  resetModules();
});

test("getDailyChallenge does not expose correct answers to the client payload", async () => {
  const dailyChallenge = loadDailyChallengeModule({
    storage: {
      readJson: () => [
        {
          id: "dc-1",
          userId: "user-1",
          challengeDate: "2026-04-04",
          questionIds: ["q-1"],
          timeLimitSeconds: 180,
          answers: null,
          score: null,
          total: 1,
          bonusXp: 0,
          completedAt: null,
          createdAt: "2026-04-04T00:00:00.000Z",
        },
      ],
    },
    content: {
      getQuestions: async () => [
        {
          id: "q-1",
          stem: "1 + 1 = ?",
          options: ["1", "2", "3", "4"],
          answer: "2",
        },
      ],
    },
  });

  const challenge = await dailyChallenge.getDailyChallenge("user-1", "2026-04-04");

  assert.equal(challenge?.questions?.[0]?.stem, "1 + 1 = ?");
  assert.equal(challenge?.questions?.[0]?.answer, undefined);
});

test("generateDailyChallenge returns the persisted row when a same-day challenge already exists", async () => {
  let selectCount = 0;
  const storedRow = {
    id: "dc-existing",
    user_id: "user-1",
    challenge_date: "2026-04-04",
    question_ids: ["q-2", "q-3", "q-4"],
    time_limit_seconds: 180,
    answers: null,
    score: null,
    total: 3,
    bonus_xp: 0,
    completed_at: null,
    created_at: "2026-04-04T00:00:00.000Z",
  };

  const dailyChallenge = loadDailyChallengeModule({
    db: {
      isDbEnabled: () => true,
      query: async () => [],
      queryOne: async (text: string) => {
        if (text.includes("SELECT * FROM daily_challenges WHERE user_id = $1 AND challenge_date = $2")) {
          selectCount += 1;
          return selectCount === 1 ? null : storedRow;
        }
        return null;
      },
    },
    content: {
      getQuestions: async () => [
        { id: "q-1", stem: "题 1", options: ["A", "B"], answer: "A", knowledgePointId: "kp-1" },
        { id: "q-2", stem: "题 2", options: ["A", "B"], answer: "A", knowledgePointId: "kp-1" },
        { id: "q-3", stem: "题 3", options: ["A", "B"], answer: "A", knowledgePointId: "kp-2" },
        { id: "q-4", stem: "题 4", options: ["A", "B"], answer: "A", knowledgePointId: "kp-3" },
      ],
    },
  });

  const challenge = await dailyChallenge.generateDailyChallenge("user-1");

  assert.equal(challenge.id, "dc-existing");
  assert.deepEqual(challenge.questionIds, ["q-2", "q-3", "q-4"]);
});

test("daily challenge generation falls back to file persistence when the database table is missing", async () => {
  const stored: Array<Record<string, unknown>> = [];
  const missingRelation = new Error('relation "daily_challenges" does not exist');
  const dailyChallenge = loadDailyChallengeModule({
    db: {
      isDbEnabled: () => true,
      query: async () => {
        throw missingRelation;
      },
      queryOne: async () => {
        throw missingRelation;
      },
    },
    storage: {
      readJson: () => stored,
      writeJson: (_file: string, data: unknown) => {
        stored.splice(0, stored.length, ...((data as Array<Record<string, unknown>>) ?? []));
      },
    },
    content: {
      getQuestions: async () => [
        { id: "q-1", stem: "题 1", options: ["A", "B"], answer: "A", knowledgePointId: "kp-1" },
        { id: "q-2", stem: "题 2", options: ["A", "B"], answer: "A", knowledgePointId: "kp-2" },
        { id: "q-3", stem: "题 3", options: ["A", "B"], answer: "A", knowledgePointId: "kp-3" },
      ],
    },
  });

  const challenge = await dailyChallenge.generateDailyChallenge("user-db-fallback");

  assert.equal(challenge.userId, "user-db-fallback");
  assert.equal(challenge.questionIds.length, 3);
  assert.equal(stored.length, 1);
  assert.equal(stored[0]?.userId, "user-db-fallback");
});
