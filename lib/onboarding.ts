import { isDbEnabled, isMissingRelationError, queryOne } from "./db";
import { readJson, updateJson } from "./storage";

export type UserOnboardingProgress = {
  userId: string;
  completedSteps: string[];
  completedAt?: string | null;
  updatedAt: string;
};

type DbOnboardingRow = {
  user_id: string;
  completed_steps: string[] | null;
  completed_at: string | null;
  updated_at: string;
};

const ONBOARDING_FILE = "user-onboarding-progress.json";

function shouldUseFileFallback(error: unknown) {
  return isMissingRelationError(error, "user_onboarding_progress");
}

function getOnboardingProgressFromFile(userId: string): UserOnboardingProgress {
  return (
    readJson<UserOnboardingProgress[]>(ONBOARDING_FILE, []).find((item) => item.userId === userId) ?? {
      userId,
      completedSteps: [],
      completedAt: null,
      updatedAt: new Date(0).toISOString()
    }
  );
}

async function completeOnboardingInFile(userId: string, completedSteps: string[], updatedAt: string) {
  await updateJson<UserOnboardingProgress[]>(ONBOARDING_FILE, [], (list) => {
    const existing = list.find((item) => item.userId === userId);
    if (existing) {
      existing.completedSteps = Array.from(new Set([...existing.completedSteps, ...completedSteps]));
      existing.completedAt = existing.completedAt ?? updatedAt;
      existing.updatedAt = updatedAt;
      return;
    }
    list.push({
      userId,
      completedSteps: Array.from(new Set(completedSteps)),
      completedAt: updatedAt,
      updatedAt
    });
  });
  return getOnboardingProgressFromFile(userId);
}

function mapRow(row: DbOnboardingRow): UserOnboardingProgress {
  return {
    userId: row.user_id,
    completedSteps: row.completed_steps ?? [],
    completedAt: row.completed_at,
    updatedAt: row.updated_at
  };
}

export async function getOnboardingProgress(userId: string): Promise<UserOnboardingProgress> {
  if (!isDbEnabled()) {
    return getOnboardingProgressFromFile(userId);
  }

  try {
    const row = await queryOne<DbOnboardingRow>(
      `SELECT * FROM user_onboarding_progress WHERE user_id = $1`,
      [userId]
    );
    return row
      ? mapRow(row)
      : {
          userId,
          completedSteps: [],
          completedAt: null,
          updatedAt: new Date(0).toISOString()
        };
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    return getOnboardingProgressFromFile(userId);
  }
}

export async function completeOnboarding(userId: string, completedSteps: string[] = ["tour"]) {
  const updatedAt = new Date().toISOString();
  if (!isDbEnabled()) {
    return completeOnboardingInFile(userId, completedSteps, updatedAt);
  }

  try {
    const row = await queryOne<DbOnboardingRow>(
      `INSERT INTO user_onboarding_progress (user_id, completed_steps, completed_at, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         completed_steps = (
           SELECT ARRAY(
             SELECT DISTINCT step
             FROM unnest(COALESCE(user_onboarding_progress.completed_steps, '{}'::text[]) || $2) AS step
           )
         ),
         completed_at = COALESCE(user_onboarding_progress.completed_at, $3),
         updated_at = $4
       RETURNING *`,
      [userId, completedSteps, updatedAt, updatedAt]
    );
    return row ? mapRow(row) : getOnboardingProgress(userId);
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }
    return completeOnboardingInFile(userId, completedSteps, updatedAt);
  }
}

export async function isOnboardingComplete(userId: string) {
  const progress = await getOnboardingProgress(userId);
  return Boolean(progress.completedAt);
}
