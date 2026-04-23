import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

type GamificationModule = typeof import("../../lib/gamification");
type OnboardingModule = typeof import("../../lib/onboarding");
type ParentEngagementModule = typeof import("../../lib/parent-engagement");
type ClassroomLiveModule = typeof import("../../lib/classroom-live");
type PblModule = typeof import("../../lib/pbl");

const MODULE_TARGETS = [
  "../../lib/gamification",
  "../../lib/onboarding",
  "../../lib/parent-engagement",
  "../../lib/classroom-live",
  "../../lib/pbl",
  "../../lib/db",
  "../../lib/storage",
  "../../lib/auth",
  "../../lib/progress",
  "../../lib/content",
  "../../lib/classes"
] as const;

function resetModules() {
  for (const target of MODULE_TARGETS) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // Ignore cache misses during isolated runs.
    }
  }
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createStorageState(seed: Record<string, unknown>) {
  const state = new Map<string, unknown>(Object.entries(seed).map(([fileName, value]) => [fileName, cloneValue(value)]));
  return {
    readJson<T>(fileName: string, fallback: T) {
      return cloneValue((state.get(fileName) as T | undefined) ?? fallback);
    },
    writeJson<T>(fileName: string, data: T) {
      state.set(fileName, cloneValue(data));
    },
    async updateJson<T>(fileName: string, fallback: T, updater: (current: T) => T | Promise<T> | void | Promise<void>) {
      const current = cloneValue((state.get(fileName) as T | undefined) ?? fallback);
      const result = await updater(current);
      const next = result === undefined ? current : result;
      state.set(fileName, cloneValue(next));
      return next;
    },
    snapshot<T>(fileName: string) {
      return cloneValue(state.get(fileName) as T);
    }
  };
}

function loadGamificationModule(options?: {
  storageSeed?: Record<string, unknown>;
  dbOverrides?: Record<string, unknown>;
}) {
  resetModules();
  const storageState = createStorageState(options?.storageSeed ?? {});
  const db = require("../../lib/db") as Record<string, unknown>;
  const storage = require("../../lib/storage") as Record<string, unknown>;

  Object.assign(db, {
    isDbEnabled: () => true,
    query: async () => [],
    queryOne: async () => null
  });
  Object.assign(storage, {
    readJson: storageState.readJson,
    writeJson: storageState.writeJson,
    updateJson: storageState.updateJson
  });

  if (options?.dbOverrides) {
    Object.assign(db, options.dbOverrides);
  }

  return {
    module: require("../../lib/gamification") as GamificationModule,
    storageState
  };
}

function loadOnboardingModule(options?: {
  storageSeed?: Record<string, unknown>;
  dbOverrides?: Record<string, unknown>;
}) {
  resetModules();
  const storageState = createStorageState(options?.storageSeed ?? {});
  const db = require("../../lib/db") as Record<string, unknown>;
  const storage = require("../../lib/storage") as Record<string, unknown>;

  Object.assign(db, {
    isDbEnabled: () => true,
    queryOne: async () => null
  });
  Object.assign(storage, {
    readJson: storageState.readJson,
    writeJson: storageState.writeJson,
    updateJson: storageState.updateJson
  });

  if (options?.dbOverrides) {
    Object.assign(db, options.dbOverrides);
  }

  return {
    module: require("../../lib/onboarding") as OnboardingModule,
    storageState
  };
}

function loadParentEngagementModule(options?: {
  storageSeed?: Record<string, unknown>;
  dbOverrides?: Record<string, unknown>;
}) {
  resetModules();
  const storageState = createStorageState(options?.storageSeed ?? {});
  const db = require("../../lib/db") as Record<string, unknown>;
  const storage = require("../../lib/storage") as Record<string, unknown>;
  const auth = require("../../lib/auth") as Record<string, unknown>;
  const progress = require("../../lib/progress") as Record<string, unknown>;
  const content = require("../../lib/content") as Record<string, unknown>;

  Object.assign(db, {
    isDbEnabled: () => true,
    query: async () => [],
    queryOne: async () => null
  });
  Object.assign(storage, {
    readJson: storageState.readJson,
    writeJson: storageState.writeJson,
    updateJson: storageState.updateJson
  });
  Object.assign(auth, {
    getUserById: async () => ({ id: "stu-1", name: "Student" })
  });
  Object.assign(progress, {
    getAttemptsByUser: async () => []
  });
  Object.assign(content, {
    getKnowledgePoints: async () => []
  });

  if (options?.dbOverrides) {
    Object.assign(db, options.dbOverrides);
  }

  return {
    module: require("../../lib/parent-engagement") as ParentEngagementModule,
    storageState
  };
}

function loadClassroomLiveModule(options?: {
  storageSeed?: Record<string, unknown>;
  dbOverrides?: Record<string, unknown>;
}) {
  resetModules();
  const storageState = createStorageState(options?.storageSeed ?? {});
  const db = require("../../lib/db") as Record<string, unknown>;
  const storage = require("../../lib/storage") as Record<string, unknown>;
  const classes = require("../../lib/classes") as Record<string, unknown>;
  const progress = require("../../lib/progress") as Record<string, unknown>;

  Object.assign(db, {
    isDbEnabled: () => true,
    query: async () => [],
    queryOne: async () => null
  });
  Object.assign(storage, {
    readJson: storageState.readJson,
    writeJson: storageState.writeJson,
    updateJson: storageState.updateJson
  });
  Object.assign(classes, {
    getClassesByTeacher: async () => [{ id: "class-1", name: "Class 1" }],
    getClassesByStudent: async () => [{ id: "class-1", name: "Class 1" }],
    getClassStudentIds: async () => ["stu-1"],
    getStudentsByClass: async () => [{ id: "stu-1", name: "Student One" }]
  });
  Object.assign(progress, {
    getAttemptsByUsers: async () => []
  });

  if (options?.dbOverrides) {
    Object.assign(db, options.dbOverrides);
  }

  return {
    module: require("../../lib/classroom-live") as ClassroomLiveModule,
    storageState
  };
}

function loadPblModule(options?: {
  storageSeed?: Record<string, unknown>;
  dbOverrides?: Record<string, unknown>;
}) {
  resetModules();
  const storageState = createStorageState(options?.storageSeed ?? {});
  const db = require("../../lib/db") as Record<string, unknown>;
  const storage = require("../../lib/storage") as Record<string, unknown>;
  const classes = require("../../lib/classes") as Record<string, unknown>;

  Object.assign(db, {
    isDbEnabled: () => true,
    query: async () => [],
    queryOne: async () => null
  });
  Object.assign(storage, {
    readJson: storageState.readJson,
    writeJson: storageState.writeJson,
    updateJson: storageState.updateJson
  });
  Object.assign(classes, {
    getClassesByTeacher: async () => [{ id: "class-1", name: "Class 1" }],
    getClassesByStudent: async () => [{ id: "class-1", name: "Class 1" }]
  });

  if (options?.dbOverrides) {
    Object.assign(db, options.dbOverrides);
  }

  return {
    module: require("../../lib/pbl") as PblModule,
    storageState
  };
}

afterEach(() => {
  resetModules();
});

test("xp summary falls back to file-backed data when legacy databases miss xp tables", async () => {
  const missingSummaryRelation = new Error('relation "student_xp_summary" does not exist');
  const { module } = loadGamificationModule({
    storageSeed: {
      "student-xp-summary.json": [
        {
          userId: "stu-1",
          totalXp: 180,
          level: 3,
          rankTitle: "知识猎人",
          updatedAt: "2026-04-04T00:00:00.000Z"
        }
      ]
    },
    dbOverrides: {
      queryOne: async () => {
        throw missingSummaryRelation;
      }
    }
  });

  const summary = await module.getXpSummary("stu-1");

  assert.equal(summary.totalXp, 180);
  assert.equal(summary.level, 3);
  assert.equal(summary.rankTitle, "知识猎人");
});

test("completeOnboarding falls back to file-backed progress when onboarding table is missing", async () => {
  const missingOnboardingRelation = new Error('relation "user_onboarding_progress" does not exist');
  const { module, storageState } = loadOnboardingModule({
    storageSeed: {
      "user-onboarding-progress.json": [
        {
          userId: "teacher-1",
          completedSteps: ["tour"],
          completedAt: "2026-04-03T00:00:00.000Z",
          updatedAt: "2026-04-03T00:00:00.000Z"
        }
      ]
    },
    dbOverrides: {
      queryOne: async () => {
        throw missingOnboardingRelation;
      }
    }
  });

  const progress = await module.completeOnboarding("teacher-1", ["teacher-compose-assignment"]);
  const stored = storageState.snapshot<Array<{ userId: string; completedSteps: string[] }>>("user-onboarding-progress.json");

  assert.deepEqual(progress.completedSteps.sort(), ["teacher-compose-assignment", "tour"]);
  assert.equal(stored.length, 1);
  assert.deepEqual(stored[0]?.completedSteps.sort(), ["teacher-compose-assignment", "tour"]);
});

test("parent encouragement and goal reads fall back to file-backed records when engagement tables are missing", async () => {
  const { module } = loadParentEngagementModule({
    storageSeed: {
      "parent-encouragements.json": [
        {
          id: "enc-1",
          parentId: "parent-1",
          studentId: "stu-1",
          message: "继续保持今天的专注节奏。",
          readAt: null,
          createdAt: "2026-04-04T08:00:00.000Z"
        }
      ],
      "parent-student-goals.json": [
        {
          id: "goal-1",
          parentId: "parent-1",
          studentId: "stu-1",
          title: "本周完成分数复习",
          targetDate: "2026-04-10",
          knowledgePointId: "kp-1",
          completedAt: null,
          createdAt: "2026-04-04T08:00:00.000Z"
        }
      ]
    },
    dbOverrides: {
      queryOne: async (text: string) => {
        if (text.includes("parent_encouragements")) {
          throw new Error('relation "parent_encouragements" does not exist');
        }
        if (text.includes("parent_student_goals")) {
          throw new Error('relation "parent_student_goals" does not exist');
        }
        return null;
      }
    }
  });

  const encouragement = await module.getLatestParentEncouragement("stu-1", true);
  const goal = await module.getActiveParentStudentGoal("parent-1", "stu-1");

  assert.equal(encouragement?.message, "继续保持今天的专注节奏。");
  assert.equal(goal?.title, "本周完成分数复习");
  assert.equal(goal?.knowledgePointId, "kp-1");
});

test("classroom live session reads fall back to file-backed records when live session table is missing", async () => {
  const { module } = loadClassroomLiveModule({
    storageSeed: {
      "classroom-live-sessions.json": [
        {
          id: "live-1",
          classId: "class-1",
          teacherId: "teacher-1",
          title: "课堂练习",
          status: "active",
          currentPrompt: "请同学们开始第一题。",
          createdAt: "2026-04-04T08:00:00.000Z",
          updatedAt: "2026-04-04T08:05:00.000Z"
        }
      ]
    },
    dbOverrides: {
      query: async () => {
        throw new Error('relation "classroom_live_sessions" does not exist');
      },
      queryOne: async () => {
        throw new Error('relation "classroom_live_sessions" does not exist');
      }
    }
  });

  const sessions = await module.getTeacherClassroomLiveSessions("teacher-1");
  const session = await module.getClassroomLiveSession("live-1");

  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]?.title, "课堂练习");
  assert.equal(session?.currentPrompt, "请同学们开始第一题。");
});

test("pbl project reads fall back to file-backed records when project tables are missing", async () => {
  const { module } = loadPblModule({
    storageSeed: {
      "pbl-projects.json": [
        {
          id: "pbl-1",
          title: "节能校园项目",
          description: "围绕校园节能做跨学科探究。",
          subjects: ["科学", "语文"],
          classId: "class-1",
          createdBy: "teacher-1",
          featured: true,
          rubric: ["定义问题", "表达清晰"],
          createdAt: "2026-04-04T08:00:00.000Z"
        }
      ],
      "pbl-tasks.json": [
        {
          id: "task-1",
          projectId: "pbl-1",
          subject: "科学",
          title: "记录能耗观察",
          description: "整理校园一周能耗数据。",
          sortOrder: 0
        }
      ],
      "pbl-submissions.json": [
        {
          id: "sub-1",
          taskId: "task-1",
          studentId: "stu-1",
          content: "完成了照明能耗观察。",
          aiFeedback: "建议补充对比数据。",
          score: 82,
          submittedAt: "2026-04-04T08:30:00.000Z"
        }
      ]
    },
    dbOverrides: {
      query: async () => {
        throw new Error('relation "pbl_projects" does not exist');
      },
      queryOne: async () => {
        throw new Error('relation "pbl_projects" does not exist');
      }
    }
  });

  const projects = await module.listPblProjectsForTeacher("teacher-1");
  const tasks = await module.getPblTasks("pbl-1");
  const submissions = await module.listPblSubmissions("task-1");

  assert.equal(projects.length, 1);
  assert.equal(projects[0]?.title, "节能校园项目");
  assert.equal(tasks[0]?.title, "记录能耗观察");
  assert.equal(submissions[0]?.aiFeedback, "建议补充对比数据。");
});
