import crypto from "crypto";
import { getUserById } from "./auth";
import { getAttemptsByUser } from "./progress";
import { getKnowledgePoints } from "./content";
import { isDbEnabled, isMissingRelationError, query, queryOne } from "./db";
import { readJson, updateJson } from "./storage";

export type ParentEncouragement = {
  id: string;
  parentId: string;
  studentId: string;
  message: string;
  readAt?: string | null;
  createdAt: string;
};

export type ParentStudentGoal = {
  id: string;
  parentId: string;
  studentId: string;
  title: string;
  targetDate: string;
  knowledgePointId?: string | null;
  completedAt?: string | null;
  createdAt: string;
};

type DbEncouragementRow = {
  id: string;
  parent_id: string;
  student_id: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

type DbGoalRow = {
  id: string;
  parent_id: string;
  student_id: string;
  title: string;
  target_date: string;
  knowledge_point_id: string | null;
  completed_at: string | null;
  created_at: string;
};

const PARENT_ENCOURAGEMENT_FILE = "parent-encouragements.json";
const PARENT_GOAL_FILE = "parent-student-goals.json";

function shouldUseFileFallback(error: unknown) {
  return isMissingRelationError(error, ["parent_encouragements", "parent_student_goals"]);
}

function getLatestParentEncouragementFromFile(studentId: string, unreadOnly: boolean) {
  const items = readJson<ParentEncouragement[]>(PARENT_ENCOURAGEMENT_FILE, [])
    .filter((item) => item.studentId === studentId && (!unreadOnly || !item.readAt))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  return items[0] ?? null;
}

async function markParentEncouragementReadInFile(id: string, readAt: string) {
  let updated = false;
  await updateJson<ParentEncouragement[]>(PARENT_ENCOURAGEMENT_FILE, [], (list) => {
    const item = list.find((entry) => entry.id === id);
    if (item) {
      item.readAt = item.readAt ?? readAt;
      updated = true;
    }
  });
  return updated;
}

async function upsertParentStudentGoalInFile(input: {
  parentId: string;
  studentId: string;
  title: string;
  targetDate: string;
  knowledgePointId?: string;
}) {
  const title = input.title.trim().slice(0, 80);
  let nextGoal: ParentStudentGoal | null = null;
  await updateJson<ParentStudentGoal[]>(PARENT_GOAL_FILE, [], (list) => {
    const existing = list.find(
      (item) => item.parentId === input.parentId && item.studentId === input.studentId && !item.completedAt
    );
    if (existing) {
      existing.title = title;
      existing.targetDate = input.targetDate;
      existing.knowledgePointId = input.knowledgePointId ?? null;
      nextGoal = existing;
      return;
    }
    nextGoal = {
      id: `goal-${crypto.randomBytes(6).toString("hex")}`,
      parentId: input.parentId,
      studentId: input.studentId,
      title,
      targetDate: input.targetDate,
      knowledgePointId: input.knowledgePointId ?? null,
      completedAt: null,
      createdAt: new Date().toISOString()
    };
    list.push(nextGoal);
  });
  return nextGoal;
}

function getActiveParentStudentGoalFromFile(parentId: string, studentId: string) {
  return (
    readJson<ParentStudentGoal[]>(PARENT_GOAL_FILE, [])
      .filter((item) => item.parentId === parentId && item.studentId === studentId && !item.completedAt)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null
  );
}

function mapEncouragement(row: DbEncouragementRow): ParentEncouragement {
  return {
    id: row.id,
    parentId: row.parent_id,
    studentId: row.student_id,
    message: row.message,
    readAt: row.read_at,
    createdAt: row.created_at
  };
}

function mapGoal(row: DbGoalRow): ParentStudentGoal {
  return {
    id: row.id,
    parentId: row.parent_id,
    studentId: row.student_id,
    title: row.title,
    targetDate: row.target_date,
    knowledgePointId: row.knowledge_point_id,
    completedAt: row.completed_at,
    createdAt: row.created_at
  };
}

function normalizeMessage(message: string) {
  return message.trim().slice(0, 50);
}

export async function sendParentEncouragement(input: {
  parentId: string;
  studentId: string;
  message: string;
}) {
  const record: ParentEncouragement = {
    id: `enc-${crypto.randomBytes(6).toString("hex")}`,
    parentId: input.parentId,
    studentId: input.studentId,
    message: normalizeMessage(input.message),
    readAt: null,
    createdAt: new Date().toISOString()
  };

  if (!isDbEnabled()) {
    await updateJson<ParentEncouragement[]>(PARENT_ENCOURAGEMENT_FILE, [], (list) => {
      list.push(record);
    });
    return record;
  }

  try {
    const row = await queryOne<DbEncouragementRow>(
      `INSERT INTO parent_encouragements (id, parent_id, student_id, message, read_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [record.id, record.parentId, record.studentId, record.message, record.readAt ?? null, record.createdAt]
    );
    return row ? mapEncouragement(row) : record;
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    await updateJson<ParentEncouragement[]>(PARENT_ENCOURAGEMENT_FILE, [], (list) => {
      list.push(record);
    });
    return record;
  }
}

export async function getLatestParentEncouragement(studentId: string, unreadOnly = false) {
  if (!isDbEnabled()) {
    return getLatestParentEncouragementFromFile(studentId, unreadOnly);
  }

  const whereSql = unreadOnly ? "AND read_at IS NULL" : "";
  try {
    const row = await queryOne<DbEncouragementRow>(
      `SELECT * FROM parent_encouragements
       WHERE student_id = $1 ${whereSql}
       ORDER BY created_at DESC
       LIMIT 1`,
      [studentId]
    );
    return row ? mapEncouragement(row) : null;
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    return getLatestParentEncouragementFromFile(studentId, unreadOnly);
  }
}

export async function markParentEncouragementRead(id: string) {
  const readAt = new Date().toISOString();
  if (!isDbEnabled()) {
    return markParentEncouragementReadInFile(id, readAt);
  }
  try {
    const rows = await query(
      `UPDATE parent_encouragements
       SET read_at = COALESCE(read_at, $2)
       WHERE id = $1
       RETURNING id`,
      [id, readAt]
    );
    return rows.length > 0;
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    return markParentEncouragementReadInFile(id, readAt);
  }
}

export async function upsertParentStudentGoal(input: {
  parentId: string;
  studentId: string;
  title: string;
  targetDate: string;
  knowledgePointId?: string;
}) {
  const title = input.title.trim().slice(0, 80);
  if (!isDbEnabled()) {
    return upsertParentStudentGoalInFile(input);
  }

  try {
    const existing = await queryOne<DbGoalRow>(
      `SELECT * FROM parent_student_goals
       WHERE parent_id = $1 AND student_id = $2 AND completed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [input.parentId, input.studentId]
    );

    if (existing) {
      const row = await queryOne<DbGoalRow>(
        `UPDATE parent_student_goals
         SET title = $2,
             target_date = $3,
             knowledge_point_id = $4
         WHERE id = $1
         RETURNING *`,
        [existing.id, title, input.targetDate, input.knowledgePointId ?? null]
      );
      return row ? mapGoal(row) : mapGoal(existing);
    }

    const row = await queryOne<DbGoalRow>(
      `INSERT INTO parent_student_goals
       (id, parent_id, student_id, title, target_date, knowledge_point_id, completed_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        `goal-${crypto.randomBytes(6).toString("hex")}`,
        input.parentId,
        input.studentId,
        title,
        input.targetDate,
        input.knowledgePointId ?? null,
        null,
        new Date().toISOString()
      ]
    );
    return row ? mapGoal(row) : null;
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    return upsertParentStudentGoalInFile(input);
  }
}

export async function getActiveParentStudentGoal(parentId: string, studentId: string) {
  if (!isDbEnabled()) {
    return getActiveParentStudentGoalFromFile(parentId, studentId);
  }
  try {
    const row = await queryOne<DbGoalRow>(
      `SELECT * FROM parent_student_goals
       WHERE parent_id = $1 AND student_id = $2 AND completed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [parentId, studentId]
    );
    return row ? mapGoal(row) : null;
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    return getActiveParentStudentGoalFromFile(parentId, studentId);
  }
}

export async function buildParentActionSuggestions(studentId: string) {
  const [student, attempts, knowledgePoints] = await Promise.all([
    getUserById(studentId),
    getAttemptsByUser(studentId),
    getKnowledgePoints()
  ]);

  const recentAttempts = attempts
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 12);
  const wrongAttempts = recentAttempts.filter((item) => !item.correct);
  const latestWeakKnowledgePointId = wrongAttempts[0]?.knowledgePointId ?? recentAttempts[0]?.knowledgePointId;
  const latestWeakKnowledgePoint = knowledgePoints.find((item) => item.id === latestWeakKnowledgePointId);

  const suggestions = [
    latestWeakKnowledgePoint
      ? `本周先陪孩子把「${latestWeakKnowledgePoint.title}」讲成自己的话，再做 2 题同类题，效果会比只催完成更好。`
      : "本周先让孩子把一道错题讲给你听，再追问“为什么这样做”，比重复刷题更容易稳住理解。",
    wrongAttempts.length >= 3
      ? "如果最近连续错题较多，建议把陪学拆成 15 分钟小段，先肯定过程，再一起找第一处关键错误。"
      : "如果孩子最近整体状态稳定，建议把一次陪学聚焦在一个知识点，不要同时追多个目标。",
    student?.grade
      ? `结合 ${student.grade} 年级节奏，建议固定一个晚间陪学时间点，用“先完成一件小事”代替泛泛提醒。`
      : "建议固定一个晚间陪学时间点，用“先完成一件小事”代替泛泛提醒。"
  ];

  return suggestions.filter(Boolean).slice(0, 3);
}
