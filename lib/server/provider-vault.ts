import { isDbEnabled, query } from "../db";
import { shouldAllowDbBootstrapFromJsonFallback } from "../runtime-guardrails";
import { readJson, updateJson } from "../storage";
import {
  listProviderIds,
  PROVIDER_CATEGORY_LABELS,
  type ServerProviderCategory,
} from "./provider-catalog";

export interface ServerProviderVaultEntry {
  apiKey?: string;
  baseUrl?: string;
  models?: string[];
  proxy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ServerProviderVault {
  providers: Record<string, ServerProviderVaultEntry>;
  tts: Record<string, ServerProviderVaultEntry>;
  asr: Record<string, ServerProviderVaultEntry>;
  pdf: Record<string, ServerProviderVaultEntry>;
  image: Record<string, ServerProviderVaultEntry>;
  video: Record<string, ServerProviderVaultEntry>;
  webSearch: Record<string, ServerProviderVaultEntry>;
}

export type ServerProviderVaultPayload = {
  categories: Array<{
    key: ServerProviderCategory;
    label: string;
    configuredCount: number;
    items: Array<{
      id: string;
      configured: boolean;
      apiKeyPreview?: string;
      baseUrl?: string;
      models?: string[];
      proxy?: string;
      updatedAt?: string;
      updatedBy?: string;
    }>;
  }>;
};

type DbServerProviderVaultRow = {
  category: string;
  provider_id: string;
  api_key: string | null;
  base_url: string | null;
  models: string[] | null;
  proxy: string | null;
  updated_at: string;
  updated_by: string | null;
};

const PROVIDER_VAULT_FILE = "server-provider-vault.json";
const PROVIDER_VAULT_CACHE_TTL_MS = 8000;

function createEmptyVault(): ServerProviderVault {
  return {
    providers: {},
    tts: {},
    asr: {},
    pdf: {},
    image: {},
    video: {},
    webSearch: {},
  };
}

function cleanString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeEntry(entry?: Partial<ServerProviderVaultEntry> | null): ServerProviderVaultEntry {
  return {
    apiKey: cleanString(entry?.apiKey),
    baseUrl: cleanString(entry?.baseUrl),
    models: Array.isArray(entry?.models)
      ? entry.models.map((item) => item.trim()).filter(Boolean)
      : undefined,
    proxy: cleanString(entry?.proxy),
    updatedAt: cleanString(entry?.updatedAt),
    updatedBy: cleanString(entry?.updatedBy),
  };
}

function hasMeaningfulEntry(entry?: Partial<ServerProviderVaultEntry> | null) {
  const normalized = normalizeEntry(entry);
  return Boolean(
    normalized.apiKey ||
      normalized.baseUrl ||
      normalized.proxy ||
      normalized.models?.length,
  );
}

function normalizeVault(vault?: Partial<ServerProviderVault> | null): ServerProviderVault {
  return {
    providers: vault?.providers ?? {},
    tts: vault?.tts ?? {},
    asr: vault?.asr ?? {},
    pdf: vault?.pdf ?? {},
    image: vault?.image ?? {},
    video: vault?.video ?? {},
    webSearch: vault?.webSearch ?? {},
  };
}

function readServerProviderVaultFromFile(): ServerProviderVault {
  return normalizeVault(readJson<ServerProviderVault>(PROVIDER_VAULT_FILE, createEmptyVault()));
}

function maskApiKey(apiKey?: string) {
  if (!apiKey) return undefined;
  if (apiKey.length <= 8) {
    return `${apiKey.slice(0, 2)}****`;
  }
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
}

function mapDbRowsToVault(rows: DbServerProviderVaultRow[]): ServerProviderVault {
  const vault = createEmptyVault();

  for (const row of rows) {
    const category = row.category as ServerProviderCategory;
    if (!(category in vault)) continue;

    const entry = normalizeEntry({
      apiKey: row.api_key ?? undefined,
      baseUrl: row.base_url ?? undefined,
      models: row.models ?? undefined,
      proxy: row.proxy ?? undefined,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by ?? undefined,
    });

    if (!hasMeaningfulEntry(entry)) continue;
    vault[category][row.provider_id] = entry;
  }

  return vault;
}

function listConfiguredVaultRows(vault: ServerProviderVault) {
  const rows: Array<{
    category: ServerProviderCategory;
    providerId: string;
    entry: ServerProviderVaultEntry;
  }> = [];

  for (const category of Object.keys(PROVIDER_CATEGORY_LABELS) as ServerProviderCategory[]) {
    const section = vault[category] ?? {};
    for (const [providerId, rawEntry] of Object.entries(section)) {
      const entry = normalizeEntry(rawEntry);
      if (!hasMeaningfulEntry(entry)) continue;
      rows.push({
        category,
        providerId,
        entry,
      });
    }
  }

  return rows;
}

let vaultCache: ServerProviderVault =
  isDbEnabled() && !shouldAllowDbBootstrapFromJsonFallback()
    ? createEmptyVault()
    : readServerProviderVaultFromFile();
let vaultCacheSyncedAt = 0;
let vaultSyncing: Promise<void> | null = null;

async function syncServerProviderVaultFromDb(force = false) {
  if (!isDbEnabled()) return;

  const now = Date.now();
  if (!force && vaultCacheSyncedAt && now - vaultCacheSyncedAt < PROVIDER_VAULT_CACHE_TTL_MS) {
    return;
  }
  if (vaultSyncing) {
    return vaultSyncing;
  }

  vaultSyncing = (async () => {
    try {
      const rows = await query<DbServerProviderVaultRow>(
        `SELECT category,
                provider_id,
                api_key,
                base_url,
                models,
                proxy,
                updated_at::text AS updated_at,
                updated_by
           FROM server_provider_vault_entries`
      );

      if (!rows.length) {
        const fallback = shouldAllowDbBootstrapFromJsonFallback()
          ? readServerProviderVaultFromFile()
          : createEmptyVault();
        const bootstrapRows = listConfiguredVaultRows(fallback);

        if (bootstrapRows.length) {
          for (const item of bootstrapRows) {
            await query(
              `INSERT INTO server_provider_vault_entries
                 (category, provider_id, api_key, base_url, models, proxy, updated_at, updated_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (category, provider_id) DO NOTHING`,
              [
                item.category,
                item.providerId,
                item.entry.apiKey ?? null,
                item.entry.baseUrl ?? null,
                item.entry.models ?? [],
                item.entry.proxy ?? null,
                item.entry.updatedAt ?? new Date().toISOString(),
                item.entry.updatedBy ?? null,
              ]
            );
          }
        }

        vaultCache = fallback;
      } else {
        vaultCache = mapDbRowsToVault(rows);
      }

      vaultCacheSyncedAt = Date.now();
    } catch {
      // Keep the last available in-memory snapshot if db hydration fails.
    } finally {
      vaultSyncing = null;
    }
  })();

  return vaultSyncing;
}

if (isDbEnabled()) {
  void syncServerProviderVaultFromDb();
}

export async function ensureServerProviderVaultReady() {
  await syncServerProviderVaultFromDb(true);
  return readServerProviderVault();
}

export function readServerProviderVault(): ServerProviderVault {
  if (isDbEnabled()) {
    void syncServerProviderVaultFromDb();
  }
  return normalizeVault(vaultCache);
}

export async function saveServerProviderVaultEntry(input: {
  category: ServerProviderCategory;
  providerId: string;
  apiKey?: string;
  baseUrl?: string;
  models?: string[];
  proxy?: string;
  updatedBy?: string;
  clearExisting?: boolean;
}) {
  const category = input.category;
  const providerId = input.providerId.trim();

  if (!isDbEnabled()) {
    await updateJson<ServerProviderVault>(PROVIDER_VAULT_FILE, createEmptyVault(), (vault) => {
      const nextSection = { ...(vault[category] ?? {}) };
      if (input.clearExisting) {
        delete nextSection[providerId];
        vault[category] = nextSection;
        return;
      }

      const currentEntry = normalizeEntry(nextSection[providerId]);
      const entry = normalizeEntry({
        apiKey: cleanString(input.apiKey) || currentEntry.apiKey,
        baseUrl: input.baseUrl !== undefined ? cleanString(input.baseUrl) : currentEntry.baseUrl,
        models: input.models !== undefined ? input.models : currentEntry.models,
        proxy: input.proxy !== undefined ? cleanString(input.proxy) : currentEntry.proxy,
        updatedAt: new Date().toISOString(),
        updatedBy: input.updatedBy,
      });

      if (hasMeaningfulEntry(entry)) {
        nextSection[providerId] = entry;
      } else {
        delete nextSection[providerId];
      }

      vault[category] = nextSection;
    });

    vaultCache = readServerProviderVaultFromFile();
    vaultCacheSyncedAt = Date.now();
    return readServerProviderVault();
  }

  await ensureServerProviderVaultReady();
  const currentVault = readServerProviderVault();
  const nextSection = { ...(currentVault[category] ?? {}) };

  if (input.clearExisting) {
    delete nextSection[providerId];
    await query(
      "DELETE FROM server_provider_vault_entries WHERE category = $1 AND provider_id = $2",
      [category, providerId]
    );
  } else {
    const currentEntry = normalizeEntry(nextSection[providerId]);
    const entry = normalizeEntry({
      apiKey: cleanString(input.apiKey) || currentEntry.apiKey,
      baseUrl: input.baseUrl !== undefined ? cleanString(input.baseUrl) : currentEntry.baseUrl,
      models: input.models !== undefined ? input.models : currentEntry.models,
      proxy: input.proxy !== undefined ? cleanString(input.proxy) : currentEntry.proxy,
      updatedAt: new Date().toISOString(),
      updatedBy: input.updatedBy,
    });

    if (hasMeaningfulEntry(entry)) {
      nextSection[providerId] = entry;
      await query(
        `INSERT INTO server_provider_vault_entries
           (category, provider_id, api_key, base_url, models, proxy, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (category, provider_id) DO UPDATE
         SET api_key = EXCLUDED.api_key,
             base_url = EXCLUDED.base_url,
             models = EXCLUDED.models,
             proxy = EXCLUDED.proxy,
             updated_at = EXCLUDED.updated_at,
             updated_by = EXCLUDED.updated_by`,
        [
          category,
          providerId,
          entry.apiKey ?? null,
          entry.baseUrl ?? null,
          entry.models ?? [],
          entry.proxy ?? null,
          entry.updatedAt ?? new Date().toISOString(),
          entry.updatedBy ?? null,
        ]
      );
    } else {
      delete nextSection[providerId];
      await query(
        "DELETE FROM server_provider_vault_entries WHERE category = $1 AND provider_id = $2",
        [category, providerId]
      );
    }
  }

  vaultCache = {
    ...currentVault,
    [category]: nextSection,
  };
  vaultCacheSyncedAt = Date.now();

  return readServerProviderVault();
}

export function buildServerProviderVaultPayload(): ServerProviderVaultPayload {
  const vault = readServerProviderVault();

  const categories = (Object.keys(PROVIDER_CATEGORY_LABELS) as ServerProviderCategory[]).map(
    (key) => {
      const section = vault[key] ?? {};
      const ids = listProviderIds(key, Object.keys(section));
      const items = ids.map((id) => {
        const entry = normalizeEntry(section[id]);
        const configured = hasMeaningfulEntry(entry);
        return {
          id,
          configured,
          apiKeyPreview: maskApiKey(entry.apiKey),
          baseUrl: entry.baseUrl,
          models: entry.models,
          proxy: entry.proxy,
          updatedAt: entry.updatedAt,
          updatedBy: entry.updatedBy,
        };
      });

      return {
        key,
        label: PROVIDER_CATEGORY_LABELS[key],
        configuredCount: items.filter((item) => item.configured).length,
        items,
      };
    }
  );

  return { categories };
}
