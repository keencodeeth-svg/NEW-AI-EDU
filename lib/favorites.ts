import crypto from "crypto";
import { readJson, writeJson } from "./storage";
import { isDbEnabled, query, queryOne } from "./db";

export type QuestionFavorite = {
  id: string;
  userId: string;
  questionId: string;
  tags: string[];
  note?: string;
  createdAt: string;
  updatedAt: string;
};

const FILE = "question-favorites.json";

type DbFavorite = {
  id: string;
  user_id: string;
  question_id: string;
  tags: string[] | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

function mapFavorite(row: DbFavorite): QuestionFavorite {
  return {
    id: row.id,
    userId: row.user_id,
    questionId: row.question_id,
    tags: row.tags ?? [],
    note: row.note ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getFavoritesByUser(userId: string): Promise<QuestionFavorite[]> {
  if (!isDbEnabled()) {
    const list = readJson<QuestionFavorite[]>(FILE, []);
    return list.filter((item) => item.userId === userId);
  }
  const rows = await query<DbFavorite>(
    "SELECT * FROM question_favorites WHERE user_id = $1 ORDER BY updated_at DESC",
    [userId]
  );
  return rows.map(mapFavorite);
}

export async function getFavoriteByUserQuestion(userId: string, questionId: string) {
  if (!isDbEnabled()) {
    const list = readJson<QuestionFavorite[]>(FILE, []);
    return list.find((item) => item.userId === userId && item.questionId === questionId) ?? null;
  }
  const row = await queryOne<DbFavorite>(
    "SELECT * FROM question_favorites WHERE user_id = $1 AND question_id = $2",
    [userId, questionId]
  );
  return row ? mapFavorite(row) : null;
}

export async function upsertFavorite(input: {
  userId: string;
  questionId: string;
  tags?: string[];
  note?: string;
}) {
  const now = new Date().toISOString();
  if (!isDbEnabled()) {
    const list = readJson<QuestionFavorite[]>(FILE, []);
    const index = list.findIndex(
      (item) => item.userId === input.userId && item.questionId === input.questionId
    );
    if (index >= 0) {
      const current = list[index];
      const updated: QuestionFavorite = {
        ...current,
        tags: input.tags ?? current.tags,
        note: input.note ?? current.note,
        updatedAt: now
      };
      list[index] = updated;
      writeJson(FILE, list);
      return updated;
    }
    const created: QuestionFavorite = {
      id: `fav-${crypto.randomBytes(6).toString("hex")}`,
      userId: input.userId,
      questionId: input.questionId,
      tags: input.tags ?? [],
      note: input.note,
      createdAt: now,
      updatedAt: now
    };
    list.unshift(created);
    writeJson(FILE, list);
    return created;
  }

  const existing = await queryOne<DbFavorite>(
    "SELECT * FROM question_favorites WHERE user_id = $1 AND question_id = $2",
    [input.userId, input.questionId]
  );
  const id = existing?.id ?? `fav-${crypto.randomBytes(6).toString("hex")}`;
  const row = await queryOne<DbFavorite>(
    `INSERT INTO question_favorites (id, user_id, question_id, tags, note, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, question_id) DO UPDATE SET
       tags = COALESCE($4, question_favorites.tags),
       note = COALESCE($5, question_favorites.note),
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [id, input.userId, input.questionId, input.tags ?? [], input.note ?? null, existing?.created_at ?? now, now]
  );
  return row ? mapFavorite(row) : null;
}

export async function removeFavorite(userId: string, questionId: string) {
  if (!isDbEnabled()) {
    const list = readJson<QuestionFavorite[]>(FILE, []);
    const next = list.filter((item) => !(item.userId === userId && item.questionId === questionId));
    writeJson(FILE, next);
    return next.length !== list.length;
  }
  const rows = await query<{ id: string }>(
    "DELETE FROM question_favorites WHERE user_id = $1 AND question_id = $2 RETURNING id",
    [userId, questionId]
  );
  return rows.length > 0;
}
