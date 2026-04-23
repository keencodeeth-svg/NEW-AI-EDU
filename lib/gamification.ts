import crypto from "crypto";
import { isDbEnabled, isMissingRelationError, query, queryOne } from "./db";
import { readJson, writeJson } from "./storage";

const LEVEL_TABLE: readonly { level: number; title: string; minXp: number }[] = [
  { level: 1, title: "学习新星", minXp: 0 },
  { level: 2, title: "探索者", minXp: 50 },
  { level: 3, title: "知识猎人", minXp: 120 },
  { level: 4, title: "解题达人", minXp: 250 },
  { level: 5, title: "征服者", minXp: 450 },
  { level: 6, title: "智慧大师", minXp: 700 },
  { level: 7, title: "学霸之星", minXp: 1000 },
  { level: 8, title: "知识王者", minXp: 1500 },
];

export type XpLedgerEntry = {
  id: string;
  userId: string;
  amount: number;
  source: string;
  sourceId: string | null;
  description: string;
  createdAt: string;
};

export type XpSummary = {
  userId: string;
  totalXp: number;
  level: number;
  rankTitle: string;
  updatedAt: string;
};

export type LevelInfo = {
  level: number;
  rankTitle: string;
  currentXp: number;
  nextLevelXp: number;
  progress: number;
};

type DbLedgerEntry = {
  id: string;
  user_id: string;
  amount: number;
  source: string;
  source_id: string | null;
  description: string;
  created_at: string;
};

type DbXpSummary = {
  user_id: string;
  total_xp: number;
  level: number;
  rank_title: string;
  updated_at: string;
};

const XP_LEDGER_FILE = "student-xp-ledger.json";
const XP_SUMMARY_FILE = "student-xp-summary.json";

function shouldUseFileFallback(error: unknown) {
  return isMissingRelationError(error, ["student_xp_summary", "student_xp_ledger"]);
}

function getXpSummaryFromFile(userId: string): XpSummary {
  const summaries = readJson<XpSummary[]>(XP_SUMMARY_FILE, []);
  return summaries.find((s) => s.userId === userId) ?? defaultSummary(userId);
}

function addXpFromFile(
  userId: string,
  amount: number,
  source: string,
  sourceId: string | undefined,
  description: string,
  now: string
) {
  const ledger = readJson<XpLedgerEntry[]>(XP_LEDGER_FILE, []);
  ledger.push({
    id: `xp-${crypto.randomBytes(6).toString("hex")}`,
    userId,
    amount,
    source,
    sourceId: sourceId ?? null,
    description,
    createdAt: now,
  });
  writeJson(XP_LEDGER_FILE, ledger);

  const summaries = readJson<XpSummary[]>(XP_SUMMARY_FILE, []);
  const existing = summaries.find((s) => s.userId === userId);
  const totalXp = (existing?.totalXp ?? 0) + amount;
  const levelInfo = computeLevel(totalXp);
  const updated: XpSummary = {
    userId,
    totalXp,
    level: levelInfo.level,
    rankTitle: levelInfo.rankTitle,
    updatedAt: now,
  };
  const next = summaries.filter((s) => s.userId !== userId);
  next.push(updated);
  writeJson(XP_SUMMARY_FILE, next);
  return updated;
}

function getXpHistoryFromFile(userId: string, limit: number) {
  const ledger = readJson<XpLedgerEntry[]>(XP_LEDGER_FILE, []);
  return ledger
    .filter((e) => e.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export function computeLevel(totalXp: number): LevelInfo {
  let currentLevel = LEVEL_TABLE[0];
  for (const entry of LEVEL_TABLE) {
    if (totalXp >= entry.minXp) {
      currentLevel = entry;
    } else {
      break;
    }
  }
  const nextLevel = LEVEL_TABLE.find((e) => e.minXp > totalXp);
  const nextLevelXp = nextLevel ? nextLevel.minXp : currentLevel.minXp;
  const rangeStart = currentLevel.minXp;
  const rangeEnd = nextLevel ? nextLevel.minXp : currentLevel.minXp + 500;
  const progress = nextLevel
    ? Math.min(100, Math.round(((totalXp - rangeStart) / (rangeEnd - rangeStart)) * 100))
    : 100;

  return {
    level: currentLevel.level,
    rankTitle: currentLevel.title,
    currentXp: totalXp,
    nextLevelXp,
    progress,
  };
}

function mapLedgerEntry(row: DbLedgerEntry): XpLedgerEntry {
  return {
    id: row.id,
    userId: row.user_id,
    amount: row.amount,
    source: row.source,
    sourceId: row.source_id,
    description: row.description,
    createdAt: row.created_at,
  };
}

function mapSummary(row: DbXpSummary): XpSummary {
  return {
    userId: row.user_id,
    totalXp: row.total_xp,
    level: row.level,
    rankTitle: row.rank_title,
    updatedAt: row.updated_at,
  };
}

function defaultSummary(userId: string): XpSummary {
  return {
    userId,
    totalXp: 0,
    level: 1,
    rankTitle: "学习新星",
    updatedAt: new Date().toISOString(),
  };
}

export async function getXpSummary(userId: string): Promise<XpSummary> {
  if (!isDbEnabled()) {
    return getXpSummaryFromFile(userId);
  }
  try {
    const row = await queryOne<DbXpSummary>(
      "SELECT * FROM student_xp_summary WHERE user_id = $1",
      [userId]
    );
    if (row) return mapSummary(row);
    return defaultSummary(userId);
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    return getXpSummaryFromFile(userId);
  }
}

export async function addXp(
  userId: string,
  amount: number,
  source: string,
  sourceId?: string,
  description?: string
): Promise<XpSummary> {
  const now = new Date().toISOString();
  const desc = description ?? `${source} +${amount} XP`;

  if (!isDbEnabled()) {
    return addXpFromFile(userId, amount, source, sourceId, desc, now);
  }

  const entryId = `xp-${crypto.randomBytes(6).toString("hex")}`;
  try {
    await query(
      `INSERT INTO student_xp_ledger (id, user_id, amount, source, source_id, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [entryId, userId, amount, source, sourceId ?? null, desc, now]
    );

    const row = await queryOne<DbXpSummary>(
      `INSERT INTO student_xp_summary (user_id, total_xp, level, rank_title, updated_at)
       VALUES ($1, $2, 1, '学习新星', $3)
       ON CONFLICT (user_id) DO UPDATE SET
         total_xp = student_xp_summary.total_xp + $2,
         updated_at = $3
       RETURNING *`,
      [userId, amount, now]
    );

    if (row) {
      const levelInfo = computeLevel(row.total_xp);
      if (levelInfo.level !== row.level || levelInfo.rankTitle !== row.rank_title) {
        await query(
          `UPDATE student_xp_summary SET level = $1, rank_title = $2, updated_at = $3 WHERE user_id = $4`,
          [levelInfo.level, levelInfo.rankTitle, now, userId]
        );
        return {
          userId,
          totalXp: row.total_xp,
          level: levelInfo.level,
          rankTitle: levelInfo.rankTitle,
          updatedAt: now,
        };
      }
      return mapSummary(row);
    }

    return defaultSummary(userId);
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    return addXpFromFile(userId, amount, source, sourceId, desc, now);
  }
}

export async function getXpHistory(userId: string, limit = 20): Promise<XpLedgerEntry[]> {
  if (!isDbEnabled()) {
    return getXpHistoryFromFile(userId, limit);
  }
  try {
    const rows = await query<DbLedgerEntry>(
      "SELECT * FROM student_xp_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
      [userId, limit]
    );
    return rows.map(mapLedgerEntry);
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    return getXpHistoryFromFile(userId, limit);
  }
}
