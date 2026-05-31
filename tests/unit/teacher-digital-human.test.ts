import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { setEnvValue, unsetEnvValue } from "./env-test-helpers";

type TeacherDigitalHumanModule = typeof import("../../lib/teacher-digital-human");

type MockDbState = {
  rows: Array<{
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
  }>;
};

const ENV_KEYS = [
  "ALLOW_JSON_FALLBACK",
  "DATA_DIR",
  "DATA_SEED_DIR",
  "DATABASE_URL",
  "NODE_ENV",
  "RUNTIME_GUARDRAILS_ENFORCE"
] as const;

const ORIGINAL_ENV = new Map<string, string | undefined>(ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV.get(key);
    if (value === undefined) {
      unsetEnvValue(key);
    } else {
      setEnvValue(key, value);
    }
  }
}

function resetModules() {
  const targets = [
    "../../lib/teacher-digital-human",
    "../../lib/storage",
    "../../lib/runtime-guardrails",
    "../../lib/db"
  ];
  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function setupTempRuntime() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-teacher-digital-human-"));
  const runtimeDir = path.join(root, "runtime");
  const seedDir = path.join(root, "seed");
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(seedDir, { recursive: true });
  return { root, runtimeDir, seedDir };
}

async function loadFileBackedModule() {
  restoreEnv();
  const { root, runtimeDir, seedDir } = await setupTempRuntime();

  setEnvValue("NODE_ENV", "development");
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  delete process.env.DATABASE_URL;
  delete process.env.ALLOW_JSON_FALLBACK;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetModules();
  const mod = require("../../lib/teacher-digital-human") as TeacherDigitalHumanModule;
  return { mod, root, runtimeDir };
}

async function loadDbBackedModule() {
  restoreEnv();
  const { root, runtimeDir, seedDir } = await setupTempRuntime();
  const dbState: MockDbState = { rows: [] };

  setEnvValue("NODE_ENV", "development");
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo";
  delete process.env.ALLOW_JSON_FALLBACK;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  resetModules();

  const dbMod = require("../../lib/db") as {
    isDbEnabled: () => boolean;
    queryOne: (text: string, params?: unknown[]) => Promise<unknown>;
    query: (text: string, params?: unknown[]) => Promise<unknown[]>;
  };

  dbMod.isDbEnabled = () => true;
  dbMod.queryOne = async (text: string, params: unknown[] = []) => {
    if (text.includes("SELECT id FROM teacher_digital_humans LIMIT 1")) {
      const first = dbState.rows[0];
      return first ? { id: first.id } : null;
    }
    if (text.includes("SELECT * FROM teacher_digital_humans WHERE teacher_id = $1")) {
      return dbState.rows.find((item) => item.teacher_id === String(params[0])) ?? null;
    }
    throw new Error(`unexpected queryOne: ${text}`);
  };
  dbMod.query = async (text: string, params: unknown[] = []) => {
    if (text.includes("INSERT INTO teacher_digital_humans")) {
      const nextRow = {
        id: String(params[0]),
        teacher_id: String(params[1]),
        display_name: String(params[2]),
        title: params[3] === null ? null : String(params[3]),
        portrait_prompt: params[4] === null ? null : String(params[4]),
        portrait_url: params[5] === null ? null : String(params[5]),
        image_provider_id: params[6] === null ? null : String(params[6]),
        voice_provider_id: params[7] === null ? null : String(params[7]),
        voice_id: params[8] === null ? null : String(params[8]),
        voice_label: params[9] === null ? null : String(params[9]),
        introduction: params[10] === null ? null : String(params[10]),
        sample_script: params[11] === null ? null : String(params[11]),
        updated_at: String(params[12])
      };
      const existingIndex = dbState.rows.findIndex((item) => item.teacher_id === nextRow.teacher_id);
      if (existingIndex >= 0) {
        if (text.includes("DO UPDATE SET")) {
          dbState.rows[existingIndex] = {
            ...dbState.rows[existingIndex],
            ...nextRow
          };
        }
      } else {
        dbState.rows.push(nextRow);
      }
      return [];
    }
    throw new Error(`unexpected query: ${text}`);
  };

  const mod = require("../../lib/teacher-digital-human") as TeacherDigitalHumanModule;
  return { mod, root, runtimeDir, dbState };
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("file-backed teacher digital human profiles persist normalized values", async () => {
  const { mod, root, runtimeDir } = await loadFileBackedModule();

  try {
    const saved = await mod.saveTeacherDigitalHumanProfile("teacher-1", "王老师", {
      displayName: "  王老师数字人  ",
      title: "  主讲教师 ",
      portraitPrompt: "  动漫教师  ",
      introduction: "  课堂节奏清楚  "
    });

    assert.equal(saved.displayName, "王老师数字人");
    assert.equal(saved.title, "主讲教师");
    assert.equal(saved.portraitPrompt, "动漫教师");
    assert.equal(saved.introduction, "课堂节奏清楚");

    const loaded = await mod.getTeacherDigitalHumanProfile("teacher-1", "王老师");
    assert.equal(loaded.displayName, "王老师数字人");

    const stored = await readJsonFile<Record<string, { displayName: string }>>(
      path.join(runtimeDir, "teacher-digital-humans.json")
    );
    assert.equal(stored["teacher-1"]?.displayName, "王老师数字人");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("db-backed teacher digital human profiles import legacy file state and persist updates", async () => {
  const { mod, root, runtimeDir, dbState } = await loadDbBackedModule();

  try {
    await fs.writeFile(
      path.join(runtimeDir, "teacher-digital-humans.json"),
      JSON.stringify(
        {
          "teacher-1": {
            teacherId: "teacher-1",
            displayName: "知序王老师",
            portraitUrl: "https://example.com/avatar.png",
            updatedAt: "2026-03-17T00:00:00.000Z"
          }
        },
        null,
        2
      )
    );

    const loaded = await mod.getTeacherDigitalHumanProfile("teacher-1", "王老师");
    assert.equal(loaded.displayName, "知序王老师");
    assert.equal(dbState.rows.length, 1);
    assert.equal(dbState.rows[0]?.portrait_url, "https://example.com/avatar.png");

    const updated = await mod.saveTeacherDigitalHumanProfile("teacher-1", "王老师", {
      voiceProviderId: "azure-tts",
      voiceId: "voice-teacher-1",
      voiceLabel: "王老师音色"
    });

    assert.equal(updated.voiceProviderId, "azure-tts");
    assert.equal(dbState.rows[0]?.voice_provider_id, "azure-tts");
    assert.equal(dbState.rows[0]?.voice_label, "王老师音色");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("guarded db-backed teacher digital human profiles ignore legacy json bootstrap", async () => {
  const { root, runtimeDir, seedDir } = await setupTempRuntime();

  try {
    restoreEnv();
    setEnvValue("NODE_ENV", "production");
    process.env.DATA_DIR = runtimeDir;
    process.env.DATA_SEED_DIR = seedDir;
    process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo";
    process.env.RUNTIME_GUARDRAILS_ENFORCE = "true";
    delete process.env.ALLOW_JSON_FALLBACK;

    await fs.writeFile(
      path.join(runtimeDir, "teacher-digital-humans.json"),
      JSON.stringify(
        {
          "teacher-guarded": {
            teacherId: "teacher-guarded",
            displayName: "不应导入",
            updatedAt: "2026-03-17T00:00:00.000Z"
          }
        },
        null,
        2
      )
    );

    resetModules();

    const dbState: MockDbState = { rows: [] };
    const dbMod = require("../../lib/db") as {
      isDbEnabled: () => boolean;
      queryOne: (text: string, params?: unknown[]) => Promise<unknown>;
      query: (text: string, params?: unknown[]) => Promise<unknown[]>;
    };

    dbMod.isDbEnabled = () => true;
    dbMod.queryOne = async (text: string, params: unknown[] = []) => {
      if (text.includes("SELECT id FROM teacher_digital_humans LIMIT 1")) {
        return null;
      }
      if (text.includes("SELECT * FROM teacher_digital_humans WHERE teacher_id = $1")) {
        return dbState.rows.find((item) => item.teacher_id === String(params[0])) ?? null;
      }
      throw new Error(`unexpected queryOne: ${text}`);
    };
    dbMod.query = async (text: string) => {
      if (text.includes("INSERT INTO teacher_digital_humans")) {
        throw new Error("guarded bootstrap should not import legacy teacher digital human json");
      }
      throw new Error(`unexpected query: ${text}`);
    };

    const mod = require("../../lib/teacher-digital-human") as TeacherDigitalHumanModule;
    const loaded = await mod.getTeacherDigitalHumanProfile("teacher-guarded", "王老师");
    assert.equal(loaded.displayName, "王老师");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
