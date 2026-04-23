import assert from "node:assert/strict";
import path from "node:path";
import { afterEach, test } from "node:test";

type ContentModule = typeof import("../../lib/content");

function resetModules() {
  const targets = [
    "../../lib/content",
    "../../lib/storage",
    "../../lib/db"
  ];

  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

function setMockModule(modulePath: string, exportsValue: Record<string, unknown>) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsValue,
    children: [],
    path: path.dirname(resolved),
    paths: []
  } as unknown as NodeModule;
}

function loadContentModule() {
  resetModules();

  const insertSql: string[] = [];
  const updateSql: string[] = [];

  setMockModule("../../lib/storage", {
    readJson: () => [],
    writeJson: () => {}
  });

  setMockModule("../../lib/db", {
    isDbEnabled: () => true,
    query: async (sql: string) => {
      if (sql.startsWith("SELECT * FROM questions")) {
        return [];
      }
      throw new Error(`Unexpected query SQL: ${sql}`);
    },
    queryOne: async (sql: string, params: unknown[]) => {
      if (sql.includes("INSERT INTO questions")) {
        insertSql.push(sql);
        if (sql.includes("actual_difficulty")) {
          throw Object.assign(
            new Error('column "actual_difficulty" of relation "questions" does not exist'),
            { code: "42703" }
          );
        }
        return {
          id: params[0],
          subject: params[1],
          grade: params[2],
          knowledge_point_id: params[3],
          stem: params[4],
          options: params[5],
          answer: params[6],
          explanation: params[7],
          difficulty: params[8],
          question_type: params[9],
          tags: params[10],
          abilities: params[11]
        };
      }

      if (sql.includes("UPDATE questions")) {
        updateSql.push(sql);
        if (sql.includes("actual_difficulty")) {
          throw Object.assign(
            new Error('column "actual_difficulty" of relation "questions" does not exist'),
            { code: "42703" }
          );
        }
        return {
          id: params[0],
          subject: params[1] ?? "math",
          grade: params[2] ?? "4",
          knowledge_point_id: params[3] ?? "kp-1",
          stem: params[4] ?? "题目",
          options: params[5] ?? ["A", "B", "C", "D"],
          answer: params[6] ?? "A",
          explanation: params[7] ?? "解析",
          difficulty: params[8] ?? "medium",
          question_type: params[9] ?? "choice",
          tags: params[10] ?? [],
          abilities: params[11] ?? []
        };
      }

      throw new Error(`Unexpected queryOne SQL: ${sql}`);
    }
  });

  const mod = require("../../lib/content") as ContentModule;
  return {
    mod,
    insertSql,
    updateSql
  };
}

afterEach(() => {
  resetModules();
});

test("createQuestion retries without quality columns on partially migrated databases", async () => {
  const { mod, insertSql } = loadContentModule();

  const question = await mod.createQuestion({
    subject: "math",
    grade: "4",
    knowledgePointId: "kp-1",
    stem: "兼容题目",
    options: ["A", "B", "C", "D"],
    answer: "A",
    explanation: "解析",
    difficulty: "medium",
    questionType: "choice",
    tags: ["api-test"],
    abilities: ["comprehension"]
  });

  assert.equal(question?.id?.startsWith("q-"), true);
  assert.deepEqual(question?.tags, ["api-test"]);
  assert.deepEqual(question?.abilities, ["comprehension"]);
  assert.equal(insertSql.length, 2);
  assert.match(insertSql[0], /actual_difficulty/);
  assert.doesNotMatch(insertSql[1], /actual_difficulty/);
});

test("updateQuestion retries without quality columns on partially migrated databases", async () => {
  const { mod, updateSql } = loadContentModule();

  const question = await mod.updateQuestion("q-1", {
    stem: "更新后的题目",
    actualDifficulty: 2,
    needsManualReview: true,
    reviewReason: "duplicate-risk"
  });

  assert.equal(question?.id, "q-1");
  assert.equal(question?.stem, "更新后的题目");
  assert.equal(updateSql.length, 2);
  assert.match(updateSql[0], /actual_difficulty/);
  assert.doesNotMatch(updateSql[1], /actual_difficulty/);
});
