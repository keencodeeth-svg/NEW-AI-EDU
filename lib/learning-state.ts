import crypto from "crypto";
import { getClassStudentIds } from "./classes";
import { getQuestions, updateQuestion } from "./content";
import { isDbEnabled, isMissingRelationError, query, queryOne } from "./db";
import { getMasteryRecordsByUser } from "./mastery";
import { readJson, updateJson } from "./storage";
import type { Question } from "./types";
export { isBreakSuggestionNeeded } from "./learning-state-helpers";

export type StudentMoodType = "good" | "neutral" | "tired";

export type StudentMoodCheckin = {
  id: string;
  userId: string;
  mood: StudentMoodType;
  context?: string;
  createdAt: string;
};

export type MoodTrendSummary = {
  total: number;
  latestMood: StudentMoodType | null;
  counts: Record<StudentMoodType, number>;
  trend: Array<{
    date: string;
    good: number;
    neutral: number;
    tired: number;
  }>;
};

type DbStudentMoodRow = {
  id: string;
  user_id: string;
  mood: StudentMoodType;
  context: string | null;
  created_at: string;
};

const STUDENT_MOOD_FILE = "student-mood-checkins.json";

function shouldUseFileFallback(error: unknown) {
  return isMissingRelationError(error, "student_mood_checkins");
}

function getStudentMoodCheckinsFromFile(userId: string, limit: number) {
  return sortMoodCheckins(readJson<StudentMoodCheckin[]>(STUDENT_MOOD_FILE, []).filter((item) => item.userId === userId)).slice(
    0,
    limit
  );
}

function mapMoodRow(row: DbStudentMoodRow): StudentMoodCheckin {
  return {
    id: row.id,
    userId: row.user_id,
    mood: row.mood,
    context: row.context ?? undefined,
    createdAt: row.created_at
  };
}

function sortMoodCheckins(list: StudentMoodCheckin[]) {
  return list
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function toDateKey(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

function buildEmptySummary(): MoodTrendSummary {
  return {
    total: 0,
    latestMood: null,
    counts: {
      good: 0,
      neutral: 0,
      tired: 0
    },
    trend: []
  };
}

export function buildMoodTrendSummary(checkins: StudentMoodCheckin[]): MoodTrendSummary {
  if (!checkins.length) {
    return buildEmptySummary();
  }

  const counts: Record<StudentMoodType, number> = {
    good: 0,
    neutral: 0,
    tired: 0
  };
  const trendMap = new Map<string, { good: number; neutral: number; tired: number }>();

  sortMoodCheckins(checkins).forEach((item) => {
    counts[item.mood] += 1;
    const dateKey = toDateKey(item.createdAt);
    const current = trendMap.get(dateKey) ?? { good: 0, neutral: 0, tired: 0 };
    current[item.mood] += 1;
    trendMap.set(dateKey, current);
  });

  return {
    total: checkins.length,
    latestMood: sortMoodCheckins(checkins)[0]?.mood ?? null,
    counts,
    trend: Array.from(trendMap.entries())
      .map(([date, item]) => ({
        date,
        good: item.good,
        neutral: item.neutral,
        tired: item.tired
      }))
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(-7)
  };
}

export async function saveStudentMoodCheckin(input: {
  userId: string;
  mood: StudentMoodType;
  context?: string;
}) {
  const record: StudentMoodCheckin = {
    id: `mood-${crypto.randomBytes(6).toString("hex")}`,
    userId: input.userId,
    mood: input.mood,
    context: input.context?.trim() ? input.context.trim() : undefined,
    createdAt: new Date().toISOString()
  };

  if (!isDbEnabled()) {
    await updateJson<StudentMoodCheckin[]>(STUDENT_MOOD_FILE, [], (list) => {
      list.push(record);
    });
    return record;
  }

  try {
    const row = await queryOne<DbStudentMoodRow>(
      `INSERT INTO student_mood_checkins (id, user_id, mood, context, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [record.id, record.userId, record.mood, record.context ?? null, record.createdAt]
    );
    return row ? mapMoodRow(row) : record;
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    await updateJson<StudentMoodCheckin[]>(STUDENT_MOOD_FILE, [], (list) => {
      list.push(record);
    });
    return record;
  }
}

export async function getStudentMoodCheckins(userId: string, limit = 30) {
  if (!isDbEnabled()) {
    return getStudentMoodCheckinsFromFile(userId, limit);
  }
  try {
    const rows = await query<DbStudentMoodRow>(
      `SELECT * FROM student_mood_checkins
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return rows.map(mapMoodRow);
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    return getStudentMoodCheckinsFromFile(userId, limit);
  }
}

export async function getClassMoodTrend(classId: string) {
  const studentIds = await getClassStudentIds(classId);
  if (!studentIds.length) {
    return {
      students: [],
      summary: buildEmptySummary()
    };
  }

  if (!isDbEnabled()) {
    const all = readJson<StudentMoodCheckin[]>(STUDENT_MOOD_FILE, []);
    const set = new Set(studentIds);
    const items = all.filter((item) => set.has(item.userId));
    return {
      students: studentIds,
      summary: buildMoodTrendSummary(items)
    };
  }

  try {
    const rows = await query<DbStudentMoodRow>(
      `SELECT * FROM student_mood_checkins
       WHERE user_id = ANY($1)
       ORDER BY created_at DESC`,
      [studentIds]
    );
    return {
      students: studentIds,
      summary: buildMoodTrendSummary(rows.map(mapMoodRow))
    };
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    const all = readJson<StudentMoodCheckin[]>(STUDENT_MOOD_FILE, []);
    const set = new Set(studentIds);
    const items = all.filter((item) => set.has(item.userId));
    return {
      students: studentIds,
      summary: buildMoodTrendSummary(items)
    };
  }
}

function normalizeDifficultyToken(value?: string | null) {
  if (value === "easy" || value === "medium" || value === "hard") {
    return value;
  }
  return "medium";
}

export async function getRecoveryQuestion(params: {
  userId: string;
  subject: string;
  grade: string;
  knowledgePointId?: string;
  excludeQuestionId?: string | null;
}): Promise<(Question & { isRecovery?: boolean }) | null> {
  const questions = await getQuestions();
  const masteryRecords = await getMasteryRecordsByUser(params.userId, params.subject);
  const masteredKnowledgePointIds = masteryRecords
    .filter((item) => item.masteryScore > 85)
    .sort((left, right) => right.masteryScore - left.masteryScore)
    .map((item) => item.knowledgePointId);

  if (!masteredKnowledgePointIds.length) {
    return null;
  }

  const preferredKnowledgePointIds = params.knowledgePointId
    ? [params.knowledgePointId, ...masteredKnowledgePointIds.filter((item) => item !== params.knowledgePointId)]
    : masteredKnowledgePointIds;

  for (const knowledgePointId of preferredKnowledgePointIds) {
    const candidates = questions.filter(
      (item) =>
        item.subject === params.subject &&
        item.grade === params.grade &&
        item.knowledgePointId === knowledgePointId &&
        normalizeDifficultyToken(item.difficulty) === "easy" &&
        item.id !== params.excludeQuestionId
    );
    if (candidates.length) {
      const selected = candidates[Math.floor(Math.random() * candidates.length)] ?? candidates[0];
      return selected ? { ...selected, isRecovery: true } : null;
    }
  }

  return null;
}

export async function markQuestionManualReview(input: {
  questionId: string;
  needsManualReview: boolean;
  reviewReason?: string | null;
}) {
  return updateQuestion(input.questionId, {
    needsManualReview: input.needsManualReview,
    reviewReason: input.reviewReason ?? undefined
  });
}
