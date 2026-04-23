import assert from "node:assert/strict";
import path from "node:path";
import { afterEach, test } from "node:test";

type AssignmentsModule = typeof import("../../lib/assignments");

function resetModules() {
  const targets = [
    "../../lib/assignments",
    "../../lib/storage",
    "../../lib/db",
    "../../lib/classes"
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

function loadAssignmentsModule() {
  resetModules();

  const assignmentInsertSql: string[] = [];

  setMockModule("../../lib/storage", {
    readJson: () => [],
    transactJsonFiles: async () => {
      throw new Error("json path should not be used in this test");
    },
    updateJson: async () => {
      throw new Error("json path should not be used in this test");
    }
  });

  setMockModule("../../lib/db", {
    isDbEnabled: () => true,
    requireDatabaseEnabled: () => {},
    query: async () => [],
    queryOne: async (sql: string, params: unknown[]) => {
      if (sql.includes("INSERT INTO assignments")) {
        assignmentInsertSql.push(sql);
        if (sql.includes("target_student_ids")) {
          throw Object.assign(new Error('column "target_student_ids" of relation "assignments" does not exist'), {
            code: "42703"
          });
        }

        return {
          id: params[0],
          class_id: params[1],
          module_id: params[2],
          title: params[3],
          description: params[4],
          due_date: params[5],
          created_at: params[6],
          submission_type: params[7],
          max_uploads: params[8],
          grading_focus: params[9]
        };
      }

      throw new Error(`Unexpected queryOne SQL: ${sql}`);
    }
  });

  setMockModule("../../lib/classes", {
    getClassStudentIds: async () => []
  });

  const mod = require("../../lib/assignments") as AssignmentsModule;
  return {
    mod,
    assignmentInsertSql
  };
}

afterEach(() => {
  resetModules();
});

test("createAssignment retries without target_student_ids on partially migrated databases", async () => {
  const { mod, assignmentInsertSql } = loadAssignmentsModule();

  const assignment = await mod.createAssignment({
    classId: "class-001",
    title: "兼容性作业",
    dueDate: "2026-04-05T08:00:00.000Z",
    questionIds: [],
    submissionType: "essay"
  });

  assert.equal(assignment.id.startsWith("assign-"), true);
  assert.equal(assignment.classId, "class-001");
  assert.equal(assignment.submissionType, "essay");
  assert.deepEqual(assignment.targetStudentIds, []);
  assert.equal(assignmentInsertSql.length, 2);
  assert.match(assignmentInsertSql[0], /target_student_ids/);
  assert.doesNotMatch(assignmentInsertSql[1], /target_student_ids/);
});
