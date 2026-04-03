import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { setEnvValue, unsetEnvValue } from "./env-test-helpers";

type ProviderVaultModule = typeof import("../../lib/server/provider-vault");

type DbVaultRow = {
  category: string;
  provider_id: string;
  api_key: string | null;
  base_url: string | null;
  models: string[] | null;
  proxy: string | null;
  updated_at: string;
  updated_by: string | null;
};

const ENV_KEYS = [
  "ALLOW_JSON_FALLBACK",
  "DATA_DIR",
  "DATA_SEED_DIR",
  "DATABASE_URL",
  "NODE_ENV",
  "RUNTIME_GUARDRAILS_ENFORCE",
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
    "../../lib/server/provider-vault",
    "../../lib/storage",
    "../../lib/runtime-guardrails",
    "../../lib/db",
  ];

  for (const target of targets) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

async function setupTempRuntime() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hk-provider-vault-"));
  const runtimeDir = path.join(root, "runtime");
  const seedDir = path.join(root, "seed");
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(seedDir, { recursive: true });
  return { root, runtimeDir, seedDir };
}

afterEach(() => {
  resetModules();
  restoreEnv();
});

test("guarded db-backed provider vault ignores legacy json bootstrap file", async () => {
  restoreEnv();
  const { root, runtimeDir, seedDir } = await setupTempRuntime();

  setEnvValue("NODE_ENV", "production");
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo";
  process.env.ALLOW_JSON_FALLBACK = "false";
  process.env.RUNTIME_GUARDRAILS_ENFORCE = "true";

  await fs.writeFile(
    path.join(runtimeDir, "server-provider-vault.json"),
    JSON.stringify(
      {
        providers: {
          deepseek: {
            apiKey: "legacy-secret",
            updatedAt: "2026-03-26T00:00:00.000Z",
          },
        },
      },
      null,
      2,
    ),
  );

  resetModules();

  const dbState = {
    rows: [] as DbVaultRow[],
    writes: 0,
  };

  const dbMod = require("../../lib/db") as {
    isDbEnabled: () => boolean;
    query: (text: string, params?: unknown[]) => Promise<unknown[]>;
  };

  dbMod.isDbEnabled = () => true;
  dbMod.query = async (text: string) => {
    if (text.includes("FROM server_provider_vault_entries")) {
      return dbState.rows;
    }
    if (text.includes("INSERT INTO server_provider_vault_entries")) {
      dbState.writes += 1;
      return [];
    }
    throw new Error(`unexpected query: ${text}`);
  };

  const mod = require("../../lib/server/provider-vault") as ProviderVaultModule;

  try {
    await mod.ensureServerProviderVaultReady();
    const vault = mod.readServerProviderVault();
    assert.deepEqual(vault.providers, {});
    assert.equal(dbState.writes, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("db-backed provider vault can bootstrap from legacy json in local mode and later persist updates", async () => {
  restoreEnv();
  const { root, runtimeDir, seedDir } = await setupTempRuntime();

  setEnvValue("NODE_ENV", "development");
  process.env.DATA_DIR = runtimeDir;
  process.env.DATA_SEED_DIR = seedDir;
  process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo";
  delete process.env.ALLOW_JSON_FALLBACK;
  delete process.env.RUNTIME_GUARDRAILS_ENFORCE;

  await fs.writeFile(
    path.join(runtimeDir, "server-provider-vault.json"),
    JSON.stringify(
      {
        tts: {
          "openai-tts": {
            apiKey: "legacy-tts-secret",
            baseUrl: "https://legacy.example.com/v1",
            updatedAt: "2026-03-26T00:00:00.000Z",
            updatedBy: "legacy-seed",
          },
        },
      },
      null,
      2,
    ),
  );

  resetModules();

  const dbState = {
    rows: [] as DbVaultRow[],
  };

  const dbMod = require("../../lib/db") as {
    isDbEnabled: () => boolean;
    query: (text: string, params?: unknown[]) => Promise<unknown[]>;
  };

  dbMod.isDbEnabled = () => true;
  dbMod.query = async (text: string, params: unknown[] = []) => {
    if (text.includes("FROM server_provider_vault_entries")) {
      return dbState.rows;
    }

    if (text.includes("INSERT INTO server_provider_vault_entries")) {
      const nextRow: DbVaultRow = {
        category: String(params[0]),
        provider_id: String(params[1]),
        api_key: (params[2] as string | null) ?? null,
        base_url: (params[3] as string | null) ?? null,
        models: Array.isArray(params[4]) ? (params[4] as string[]) : [],
        proxy: (params[5] as string | null) ?? null,
        updated_at: String(params[6]),
        updated_by: (params[7] as string | null) ?? null,
      };
      const index = dbState.rows.findIndex(
        (row) =>
          row.category === nextRow.category && row.provider_id === nextRow.provider_id,
      );
      if (index >= 0) {
        dbState.rows[index] = nextRow;
      } else {
        dbState.rows.push(nextRow);
      }
      return [];
    }

    if (text.includes("DELETE FROM server_provider_vault_entries")) {
      dbState.rows = dbState.rows.filter(
        (row) =>
          !(
            row.category === String(params[0]) && row.provider_id === String(params[1])
          ),
      );
      return [];
    }

    throw new Error(`unexpected query: ${text}`);
  };

  const mod = require("../../lib/server/provider-vault") as ProviderVaultModule;

  try {
    await mod.ensureServerProviderVaultReady();
    assert.equal(dbState.rows.length, 1);
    assert.equal(dbState.rows[0]?.api_key, "legacy-tts-secret");

    const initialVault = mod.readServerProviderVault();
    assert.equal(initialVault.tts["openai-tts"]?.baseUrl, "https://legacy.example.com/v1");

    await mod.saveServerProviderVaultEntry({
      category: "tts",
      providerId: "openai-tts",
      baseUrl: "https://server.example.com/v2",
      updatedBy: "admin-1",
    });

    const nextVault = mod.readServerProviderVault();
    assert.equal(nextVault.tts["openai-tts"]?.apiKey, "legacy-tts-secret");
    assert.equal(nextVault.tts["openai-tts"]?.baseUrl, "https://server.example.com/v2");
    assert.equal(nextVault.tts["openai-tts"]?.updatedBy, "admin-1");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
