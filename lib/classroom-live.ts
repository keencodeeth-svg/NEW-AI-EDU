import crypto from "crypto";
import { getClassesByStudent, getClassesByTeacher, getClassStudentIds, getStudentsByClass } from "./classes";
import { getAttemptsByUsers } from "./progress";
import { isDbEnabled, isMissingRelationError, query, queryOne } from "./db";
import { readJson, updateJson } from "./storage";

export type ClassroomLiveSession = {
  id: string;
  classId: string;
  teacherId: string;
  title: string;
  status: "active" | "ended";
  currentPrompt: string;
  createdAt: string;
  updatedAt: string;
};

type DbClassroomLiveRow = {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  status: "active" | "ended";
  current_prompt: string;
  created_at: string;
  updated_at: string;
};

const CLASSROOM_LIVE_FILE = "classroom-live-sessions.json";

function shouldUseFileFallback(error: unknown) {
  return isMissingRelationError(error, "classroom_live_sessions");
}

function mapRow(row: DbClassroomLiveRow): ClassroomLiveSession {
  return {
    id: row.id,
    classId: row.class_id,
    teacherId: row.teacher_id,
    title: row.title,
    status: row.status,
    currentPrompt: row.current_prompt,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createClassroomLiveSession(input: {
  classId: string;
  teacherId: string;
  title: string;
}) {
  const record: ClassroomLiveSession = {
    id: `live-${crypto.randomBytes(6).toString("hex")}`,
    classId: input.classId,
    teacherId: input.teacherId,
    title: input.title.trim() || "课堂练习",
    status: "active",
    currentPrompt: "老师已发起课堂练习，请同学们进入当前题目。",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!isDbEnabled()) {
    await updateJson<ClassroomLiveSession[]>(CLASSROOM_LIVE_FILE, [], (list) => {
      list.push(record);
    });
    return record;
  }
  try {
    const row = await queryOne<DbClassroomLiveRow>(
      `INSERT INTO classroom_live_sessions
       (id, class_id, teacher_id, title, status, current_prompt, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [record.id, record.classId, record.teacherId, record.title, record.status, record.currentPrompt, record.createdAt, record.updatedAt]
    );
    return row ? mapRow(row) : record;
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    await updateJson<ClassroomLiveSession[]>(CLASSROOM_LIVE_FILE, [], (list) => {
      list.push(record);
    });
    return record;
  }
}

export async function updateClassroomLivePrompt(input: {
  sessionId: string;
  currentPrompt: string;
  status?: ClassroomLiveSession["status"];
}) {
  const updatedAt = new Date().toISOString();
  if (!isDbEnabled()) {
    await updateJson<ClassroomLiveSession[]>(CLASSROOM_LIVE_FILE, [], (list) => {
      const existing = list.find((item) => item.id === input.sessionId);
      if (existing) {
        existing.currentPrompt = input.currentPrompt;
        existing.status = input.status ?? existing.status;
        existing.updatedAt = updatedAt;
      }
    });
    return getClassroomLiveSession(input.sessionId);
  }
  try {
    const row = await queryOne<DbClassroomLiveRow>(
      `UPDATE classroom_live_sessions
       SET current_prompt = $2,
           status = COALESCE($3, status),
           updated_at = $4
       WHERE id = $1
       RETURNING *`,
      [input.sessionId, input.currentPrompt, input.status ?? null, updatedAt]
    );
    return row ? mapRow(row) : null;
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    await updateJson<ClassroomLiveSession[]>(CLASSROOM_LIVE_FILE, [], (list) => {
      const existing = list.find((item) => item.id === input.sessionId);
      if (existing) {
        existing.currentPrompt = input.currentPrompt;
        existing.status = input.status ?? existing.status;
        existing.updatedAt = updatedAt;
      }
    });
    return getClassroomLiveSession(input.sessionId);
  }
}

export async function getClassroomLiveSession(sessionId: string) {
  if (!isDbEnabled()) {
    return readJson<ClassroomLiveSession[]>(CLASSROOM_LIVE_FILE, []).find((item) => item.id === sessionId) ?? null;
  }
  try {
    const row = await queryOne<DbClassroomLiveRow>(
      `SELECT * FROM classroom_live_sessions WHERE id = $1`,
      [sessionId]
    );
    return row ? mapRow(row) : null;
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    return readJson<ClassroomLiveSession[]>(CLASSROOM_LIVE_FILE, []).find((item) => item.id === sessionId) ?? null;
  }
}

export async function getTeacherClassroomLiveSessions(teacherId: string) {
  const classes = await getClassesByTeacher(teacherId);
  const classIds = new Set(classes.map((item) => item.id));
  if (!classIds.size) {
    return [] as ClassroomLiveSession[];
  }
  if (!isDbEnabled()) {
    return readJson<ClassroomLiveSession[]>(CLASSROOM_LIVE_FILE, [])
      .filter((item) => classIds.has(item.classId))
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  }
  try {
    const rows = await query<DbClassroomLiveRow>(
      `SELECT * FROM classroom_live_sessions
       WHERE class_id = ANY($1)
       ORDER BY updated_at DESC`,
      [Array.from(classIds)]
    );
    return rows.map(mapRow);
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    return readJson<ClassroomLiveSession[]>(CLASSROOM_LIVE_FILE, [])
      .filter((item) => classIds.has(item.classId))
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  }
}

export async function getStudentActiveClassroomLiveSessions(studentId: string) {
  const classes = await getClassesByStudent(studentId);
  const classIds = new Set(classes.map((item) => item.id));
  if (!classIds.size) {
    return [] as ClassroomLiveSession[];
  }
  if (!isDbEnabled()) {
    return readJson<ClassroomLiveSession[]>(CLASSROOM_LIVE_FILE, [])
      .filter((item) => item.status === "active" && classIds.has(item.classId))
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  }
  try {
    const rows = await query<DbClassroomLiveRow>(
      `SELECT * FROM classroom_live_sessions
       WHERE class_id = ANY($1) AND status = 'active'
       ORDER BY updated_at DESC`,
      [Array.from(classIds)]
    );
    return rows.map(mapRow);
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    return readJson<ClassroomLiveSession[]>(CLASSROOM_LIVE_FILE, [])
      .filter((item) => item.status === "active" && classIds.has(item.classId))
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  }
}

export async function getClassroomLiveSnapshot(sessionId: string) {
  const session = await getClassroomLiveSession(sessionId);
  if (!session) {
    return null;
  }
  const [studentIds, students] = await Promise.all([
    getClassStudentIds(session.classId),
    getStudentsByClass(session.classId)
  ]);
  const attempts = await getAttemptsByUsers(studentIds);
  const sessionAttempts = attempts.filter(
    (item) => new Date(item.createdAt).getTime() >= new Date(session.createdAt).getTime()
  );
  const studentMetrics = studentIds.map((studentId) => {
    const studentAttempts = sessionAttempts
      .filter((item) => item.userId === studentId)
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
    const correctCount = studentAttempts.filter((item) => item.correct).length;
    const total = studentAttempts.length;
    return {
      studentId,
      studentName: students.find((item) => item.id === studentId)?.name ?? "未命名学生",
      total,
      correctCount,
      firstAnswerAt: studentAttempts[0]?.createdAt ?? null,
      latestAnswerAt: studentAttempts[studentAttempts.length - 1]?.createdAt ?? null
    };
  });

  const answeredStudents = studentMetrics.filter((item) => item.total > 0);
  const totalAnswered = answeredStudents.length;
  const totalStudents = studentIds.length;
  const totalCorrect = sessionAttempts.filter((item) => item.correct).length;
  const accuracy = sessionAttempts.length ? Math.round((totalCorrect / sessionAttempts.length) * 100) : 0;
  const fastestStudents = answeredStudents
    .slice()
    .sort((left, right) => {
      const leftTs = left.firstAnswerAt ? new Date(left.firstAnswerAt).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTs = right.firstAnswerAt ? new Date(right.firstAnswerAt).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTs - rightTs;
    })
    .slice(0, 3);
  const slowestStudents = studentMetrics
    .slice()
    .sort((left, right) => left.total - right.total || left.studentName.localeCompare(right.studentName, "zh-CN"))
    .slice(0, 3);

  return {
    session,
    totalAnswered,
    totalStudents,
    accuracy,
    fastestStudents,
    slowestStudents
  };
}
