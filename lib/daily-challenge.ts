import crypto from "crypto";
import { isDbEnabled, isMissingRelationError, query, queryOne } from "./db";
import { readJson, writeJson } from "./storage";
import { getQuestions } from "./content";
import { getMasteryRecordsByUser } from "./mastery";
import { addXp } from "./gamification";

export type DailyChallenge = {
  id: string;
  userId: string;
  challengeDate: string;
  questionIds: string[];
  timeLimitSeconds: number;
  answers: Record<string, string> | null;
  score: number | null;
  total: number;
  bonusXp: number;
  completedAt: string | null;
  createdAt: string;
  questions?: Array<{ id: string; stem: string; options: string[]; answer?: string }>;
};

type DbDailyChallenge = {
  id: string;
  user_id: string;
  challenge_date: string;
  question_ids: string[];
  time_limit_seconds: number;
  answers: Record<string, string> | null;
  score: number | null;
  total: number;
  bonus_xp: number;
  completed_at: string | null;
  created_at: string;
};

const DAILY_CHALLENGE_FILE = "daily-challenges.json";

function shouldUseFileFallback(error: unknown) {
  return isMissingRelationError(error, "daily_challenges");
}

function readDailyChallengesFromFile() {
  return readJson<DailyChallenge[]>(DAILY_CHALLENGE_FILE, []);
}

function mapChallenge(row: DbDailyChallenge): DailyChallenge {
  return {
    id: row.id,
    userId: row.user_id,
    challengeDate: row.challenge_date,
    questionIds: row.question_ids,
    timeLimitSeconds: row.time_limit_seconds,
    answers: row.answers,
    score: row.score,
    total: row.total,
    bonusXp: row.bonus_xp,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

function todayDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function attachQuestions(
  challenge: DailyChallenge,
  options?: { includeAnswers?: boolean }
): Promise<DailyChallenge> {
  const includeAnswers = options?.includeAnswers ?? false;
  const allQuestions = await getQuestions();
  const qMap = new Map(allQuestions.map((q) => [q.id, q]));
  const questions = challenge.questionIds
    .map((qId) => {
      const q = qMap.get(qId);
      if (!q) return null;
      return {
        id: q.id,
        stem: q.stem,
        options: q.options,
        ...(includeAnswers ? { answer: q.answer } : {}),
      };
    })
    .filter((q): q is NonNullable<typeof q> => q !== null);
  return { ...challenge, questions };
}

export async function getDailyChallenge(
  userId: string,
  date?: string
): Promise<DailyChallenge | null> {
  const targetDate = date ?? todayDateKey();

  if (!isDbEnabled()) {
    const challenges = readDailyChallengesFromFile();
    const found = challenges.find(
      (c) => c.userId === userId && c.challengeDate === targetDate
    );
    return found ? attachQuestions(found) : null;
  }

  try {
    const row = await queryOne<DbDailyChallenge>(
      "SELECT * FROM daily_challenges WHERE user_id = $1 AND challenge_date = $2",
      [userId, targetDate]
    );
    if (!row) return null;
    return attachQuestions(mapChallenge(row));
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    const challenges = readDailyChallengesFromFile();
    const found = challenges.find((c) => c.userId === userId && c.challengeDate === targetDate);
    return found ? attachQuestions(found) : null;
  }
}

export async function generateDailyChallenge(
  userId: string
): Promise<DailyChallenge> {
  const date = todayDateKey();
  const existing = await getDailyChallenge(userId, date);
  if (existing) return existing;

  const masteryRecords = await getMasteryRecordsByUser(userId);
  const weakKpIds = masteryRecords
    .slice()
    .sort((a, b) => a.masteryScore - b.masteryScore)
    .slice(0, 5)
    .map((r) => r.knowledgePointId);

  const allQuestions = await getQuestions();
  const weakKpSet = new Set(weakKpIds);

  let candidates = allQuestions.filter((q) => weakKpSet.has(q.knowledgePointId));
  if (candidates.length < 3) {
    candidates = allQuestions;
  }

  const shuffled = candidates
    .slice()
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const challengeId = `dc-${crypto.randomBytes(6).toString("hex")}`;
  const now = new Date().toISOString();

  const challenge: DailyChallenge = {
    id: challengeId,
    userId,
    challengeDate: date,
    questionIds: shuffled.map((q) => q.id),
    timeLimitSeconds: 180,
    answers: null,
    score: null,
    total: shuffled.length,
    bonusXp: 0,
    completedAt: null,
    createdAt: now,
  };

  if (!isDbEnabled()) {
    const challenges = readDailyChallengesFromFile();
    challenges.push(challenge);
    writeJson(DAILY_CHALLENGE_FILE, challenges);
    return attachQuestions(challenge);
  }

  try {
    await query(
      `INSERT INTO daily_challenges (id, user_id, challenge_date, question_ids, time_limit_seconds, total, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, challenge_date) DO NOTHING`,
      [challengeId, userId, date, shuffled.map((q) => q.id), 180, shuffled.length, now]
    );

    const stored = await queryOne<DbDailyChallenge>(
      "SELECT * FROM daily_challenges WHERE user_id = $1 AND challenge_date = $2",
      [userId, date]
    );

    return attachQuestions(stored ? mapChallenge(stored) : challenge);
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    const challenges = readDailyChallengesFromFile();
    challenges.push(challenge);
    writeJson(DAILY_CHALLENGE_FILE, challenges);
    return attachQuestions(challenge);
  }
}

export async function submitDailyChallenge(
  userId: string,
  challengeId: string,
  answers: Record<string, string>
): Promise<DailyChallenge> {
  const allQuestions = await getQuestions();
  const qMap = new Map(allQuestions.map((q) => [q.id, q]));
  const now = new Date().toISOString();

  if (!isDbEnabled()) {
    const challenges = readDailyChallengesFromFile();
    const index = challenges.findIndex(
      (c) => c.id === challengeId && c.userId === userId
    );
    if (index === -1) throw new Error("Challenge not found");
    const challenge = challenges[index];
    if (challenge.completedAt) return attachQuestions(challenge);

    let score = 0;
    for (const qId of challenge.questionIds) {
      const q = qMap.get(qId);
      if (q && answers[qId] === q.answer) score += 1;
    }

    const perfect = score === challenge.total;
    const bonusXp = perfect ? 25 : 15;

    challenge.answers = answers;
    challenge.score = score;
    challenge.bonusXp = bonusXp;
    challenge.completedAt = now;
    challenges[index] = challenge;
    writeJson(DAILY_CHALLENGE_FILE, challenges);

    try {
      const desc = perfect
        ? `每日挑战满分 +${bonusXp} XP`
        : `每日挑战完成 +${bonusXp} XP`;
      await addXp(userId, bonusXp, "daily_challenge", challengeId, desc);
    } catch {
      // XP failure should not block challenge submission
    }

    return attachQuestions(challenge);
  }

  try {
    const row = await queryOne<DbDailyChallenge>(
      "SELECT * FROM daily_challenges WHERE id = $1 AND user_id = $2",
      [challengeId, userId]
    );
    if (!row) throw new Error("Challenge not found");
    if (row.completed_at) return attachQuestions(mapChallenge(row));

    let score = 0;
    for (const qId of row.question_ids) {
      const q = qMap.get(qId);
      if (q && answers[qId] === q.answer) score += 1;
    }

    const perfect = score === row.total;
    const bonusXp = perfect ? 25 : 15;

    const updated = await queryOne<DbDailyChallenge>(
      `UPDATE daily_challenges
       SET answers = $1, score = $2, bonus_xp = $3, completed_at = $4
       WHERE id = $5 AND user_id = $6 AND completed_at IS NULL
       RETURNING *`,
      [JSON.stringify(answers), score, bonusXp, now, challengeId, userId]
    );

    if (updated) {
      try {
        const desc = perfect
          ? `每日挑战满分 +${bonusXp} XP`
          : `每日挑战完成 +${bonusXp} XP`;
        await addXp(userId, bonusXp, "daily_challenge", challengeId, desc);
      } catch {
        // XP failure should not block challenge submission
      }

      return attachQuestions(mapChallenge(updated));
    }

    const latest = await queryOne<DbDailyChallenge>(
      "SELECT * FROM daily_challenges WHERE id = $1 AND user_id = $2",
      [challengeId, userId]
    );

    return attachQuestions(mapChallenge(latest ?? row));
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    const challenges = readDailyChallengesFromFile();
    const index = challenges.findIndex((c) => c.id === challengeId && c.userId === userId);
    if (index === -1) throw new Error("Challenge not found");
    const challenge = challenges[index];
    if (challenge.completedAt) return attachQuestions(challenge);

    let score = 0;
    for (const qId of challenge.questionIds) {
      const q = qMap.get(qId);
      if (q && answers[qId] === q.answer) score += 1;
    }

    const perfect = score === challenge.total;
    const bonusXp = perfect ? 25 : 15;

    challenge.answers = answers;
    challenge.score = score;
    challenge.bonusXp = bonusXp;
    challenge.completedAt = now;
    challenges[index] = challenge;
    writeJson(DAILY_CHALLENGE_FILE, challenges);

    try {
      const desc = perfect
        ? `每日挑战满分 +${bonusXp} XP`
        : `每日挑战完成 +${bonusXp} XP`;
      await addXp(userId, bonusXp, "daily_challenge", challengeId, desc);
    } catch {
      // XP failure should not block challenge submission
    }

    return attachQuestions(challenge);
  }
}

export async function getDailyChallengeHistory(
  userId: string,
  days = 7
): Promise<DailyChallenge[]> {
  if (!isDbEnabled()) {
    const challenges = readDailyChallengesFromFile();
    return challenges
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.challengeDate.localeCompare(a.challengeDate))
      .slice(0, days);
  }

  try {
    const rows = await query<DbDailyChallenge>(
      "SELECT * FROM daily_challenges WHERE user_id = $1 ORDER BY challenge_date DESC LIMIT $2",
      [userId, days]
    );
    return rows.map(mapChallenge);
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    const challenges = readDailyChallengesFromFile();
    return challenges
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.challengeDate.localeCompare(a.challengeDate))
      .slice(0, days);
  }
}
