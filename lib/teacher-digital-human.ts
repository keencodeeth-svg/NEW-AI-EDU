import crypto from "crypto";
import { isDbEnabled, query, queryOne } from "./db";
import { shouldAllowDbBootstrapFromJsonFallback } from "./runtime-guardrails";
import { readJson, writeJson } from "./storage";
import type { TeacherDigitalHumanProfile } from "./classroom-integration";

const TEACHER_DIGITAL_HUMAN_FILE = "teacher-digital-humans.json";

type TeacherDigitalHumanStore = Record<string, TeacherDigitalHumanProfile>;

type DbTeacherDigitalHuman = {
  id: string;
  teacher_id: string;
  display_name: string;
  title: string | null;
  portrait_prompt: string | null;
  portrait_url: string | null;
  image_provider_id: string | null;
  voice_provider_id: string | null;
  voice_id: string | null;
  voice_label: string | null;
  introduction: string | null;
  sample_script: string | null;
  updated_at: string;
};

let dbBootstrapReady: Promise<void> | null = null;
let dbBootstrapCompleted = false;

function normalizeText(value: string | null | undefined) {
  if (typeof value !== "string") return undefined;
  const next = value.trim();
  return next.length ? next : undefined;
}

function normalizeProfile(
  teacherId: string,
  profile: Partial<TeacherDigitalHumanProfile>,
  fallbackName: string,
): TeacherDigitalHumanProfile {
  return {
    teacherId,
    displayName: normalizeText(profile.displayName) || fallbackName,
    title: normalizeText(profile.title),
    portraitPrompt: normalizeText(profile.portraitPrompt),
    portraitUrl: normalizeText(profile.portraitUrl),
    imageProviderId: profile.imageProviderId,
    voiceProviderId: profile.voiceProviderId,
    voiceId: normalizeText(profile.voiceId),
    voiceLabel: normalizeText(profile.voiceLabel),
    introduction: normalizeText(profile.introduction),
    sampleScript: normalizeText(profile.sampleScript),
    updatedAt: profile.updatedAt || new Date().toISOString(),
  };
}

function mapDbTeacherDigitalHuman(row: DbTeacherDigitalHuman): TeacherDigitalHumanProfile {
  return {
    teacherId: row.teacher_id,
    displayName: row.display_name,
    title: row.title ?? undefined,
    portraitPrompt: row.portrait_prompt ?? undefined,
    portraitUrl: row.portrait_url ?? undefined,
    imageProviderId: row.image_provider_id as TeacherDigitalHumanProfile["imageProviderId"],
    voiceProviderId: row.voice_provider_id as TeacherDigitalHumanProfile["voiceProviderId"],
    voiceId: row.voice_id ?? undefined,
    voiceLabel: row.voice_label ?? undefined,
    introduction: row.introduction ?? undefined,
    sampleScript: row.sample_script ?? undefined,
    updatedAt: row.updated_at,
  };
}

async function bootstrapDbFromFileIfNeeded() {
  if (!isDbEnabled() || dbBootstrapCompleted) return;
  if (dbBootstrapReady) return dbBootstrapReady;

  dbBootstrapReady = (async () => {
    try {
      const existing = await queryOne<{ id: string }>("SELECT id FROM teacher_digital_humans LIMIT 1");
      if (existing) {
        dbBootstrapCompleted = true;
        return;
      }

      const fallback = shouldAllowDbBootstrapFromJsonFallback()
        ? readJson<TeacherDigitalHumanStore>(TEACHER_DIGITAL_HUMAN_FILE, {})
        : {};

      for (const [teacherId, profile] of Object.entries(fallback)) {
        const normalized = normalizeProfile(teacherId, profile, profile.displayName || "教师数字人");
        await query(
          `INSERT INTO teacher_digital_humans
            (id, teacher_id, display_name, title, portrait_prompt, portrait_url, image_provider_id, voice_provider_id, voice_id, voice_label, introduction, sample_script, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (teacher_id) DO NOTHING`,
          [
            `teacher-digital-human-${crypto.randomBytes(6).toString("hex")}`,
            normalized.teacherId,
            normalized.displayName,
            normalized.title ?? null,
            normalized.portraitPrompt ?? null,
            normalized.portraitUrl ?? null,
            normalized.imageProviderId ?? null,
            normalized.voiceProviderId ?? null,
            normalized.voiceId ?? null,
            normalized.voiceLabel ?? null,
            normalized.introduction ?? null,
            normalized.sampleScript ?? null,
            normalized.updatedAt,
          ],
        );
      }

      dbBootstrapCompleted = true;
    } finally {
      dbBootstrapReady = null;
    }
  })();

  return dbBootstrapReady;
}

export async function getTeacherDigitalHumanProfile(
  teacherId: string,
  fallbackName: string,
): Promise<TeacherDigitalHumanProfile> {
  if (!isDbEnabled()) {
    const store = readJson<TeacherDigitalHumanStore>(TEACHER_DIGITAL_HUMAN_FILE, {});
    return normalizeProfile(teacherId, store[teacherId] ?? {}, fallbackName);
  }

  await bootstrapDbFromFileIfNeeded();
  const row = await queryOne<DbTeacherDigitalHuman>(
    "SELECT * FROM teacher_digital_humans WHERE teacher_id = $1",
    [teacherId],
  );
  return row ? mapDbTeacherDigitalHuman(row) : normalizeProfile(teacherId, {}, fallbackName);
}

export async function saveTeacherDigitalHumanProfile(
  teacherId: string,
  fallbackName: string,
  profile: Partial<TeacherDigitalHumanProfile>,
): Promise<TeacherDigitalHumanProfile> {
  const existing = await getTeacherDigitalHumanProfile(teacherId, fallbackName);
  const normalized = normalizeProfile(teacherId, { ...existing, ...profile }, fallbackName);

  if (!isDbEnabled()) {
    const store = readJson<TeacherDigitalHumanStore>(TEACHER_DIGITAL_HUMAN_FILE, {});
    store[teacherId] = normalized;
    writeJson(TEACHER_DIGITAL_HUMAN_FILE, store);
    return normalized;
  }

  await query(
    `INSERT INTO teacher_digital_humans
      (id, teacher_id, display_name, title, portrait_prompt, portrait_url, image_provider_id, voice_provider_id, voice_id, voice_label, introduction, sample_script, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (teacher_id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       title = EXCLUDED.title,
       portrait_prompt = EXCLUDED.portrait_prompt,
       portrait_url = EXCLUDED.portrait_url,
       image_provider_id = EXCLUDED.image_provider_id,
       voice_provider_id = EXCLUDED.voice_provider_id,
       voice_id = EXCLUDED.voice_id,
       voice_label = EXCLUDED.voice_label,
       introduction = EXCLUDED.introduction,
       sample_script = EXCLUDED.sample_script,
       updated_at = EXCLUDED.updated_at`,
    [
      `teacher-digital-human-${crypto.randomBytes(6).toString("hex")}`,
      normalized.teacherId,
      normalized.displayName,
      normalized.title ?? null,
      normalized.portraitPrompt ?? null,
      normalized.portraitUrl ?? null,
      normalized.imageProviderId ?? null,
      normalized.voiceProviderId ?? null,
      normalized.voiceId ?? null,
      normalized.voiceLabel ?? null,
      normalized.introduction ?? null,
      normalized.sampleScript ?? null,
      normalized.updatedAt,
    ],
  );

  dbBootstrapCompleted = true;
  return normalized;
}
