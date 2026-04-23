/**
 * Server-side Provider Configuration
 *
 * Loads provider configs from YAML (primary) + environment variables (fallback).
 * Keys never leave the server — only provider IDs and metadata are exposed via API.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { createLogger } from '@/lib/logger';
import {
  ASR_ENV_MAP,
  IMAGE_ENV_MAP,
  LLM_ENV_MAP,
  PDF_ENV_MAP,
  TTS_ENV_MAP,
  VIDEO_ENV_MAP,
  WEB_SEARCH_ENV_MAP,
  type ServerProviderCategory,
} from '@/lib/server/provider-catalog';
import {
  resolveManagedBaseUrl,
  resolveManagedSecret,
} from '@/lib/server/provider-secret-policy';
import {
  ensureServerProviderVaultReady,
  readServerProviderVault,
} from '@/lib/server/provider-vault';

export {
  getBlockedClientProviderSecretMessage,
  getProviderVaultHint,
  hasClientProviderSecretOverride,
  shouldAllowClientProviderSecrets,
} from '@/lib/server/provider-secret-policy';

const log = createLogger('ServerProviderConfig');

function createEmptyVault() {
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

function readServerProviderVaultSafely() {
  try {
    return readServerProviderVault();
  } catch (error) {
    log.warn('[ServerProviderConfig] Failed to read provider vault, using empty vault:', error);
    return createEmptyVault();
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServerProviderEntry {
  apiKey: string;
  baseUrl?: string;
  models?: string[];
  proxy?: string;
}

interface ServerConfig {
  providers: Record<string, ServerProviderEntry>;
  tts: Record<string, ServerProviderEntry>;
  asr: Record<string, ServerProviderEntry>;
  pdf: Record<string, ServerProviderEntry>;
  image: Record<string, ServerProviderEntry>;
  video: Record<string, ServerProviderEntry>;
  webSearch: Record<string, ServerProviderEntry>;
}

// ---------------------------------------------------------------------------
// Env-var prefix mappings
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// YAML loading
// ---------------------------------------------------------------------------

type YamlData = Partial<{
  providers: Record<string, Partial<ServerProviderEntry>>;
  tts: Record<string, Partial<ServerProviderEntry>>;
  asr: Record<string, Partial<ServerProviderEntry>>;
  pdf: Record<string, Partial<ServerProviderEntry>>;
  image: Record<string, Partial<ServerProviderEntry>>;
  video: Record<string, Partial<ServerProviderEntry>>;
  'web-search': Record<string, Partial<ServerProviderEntry>>;
}>;

function loadYamlFile(filename: string): YamlData {
  try {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = yaml.load(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as YamlData;
  } catch (e) {
    log.warn(`[ServerProviderConfig] Failed to load ${filename}:`, e);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Env-var helpers
// ---------------------------------------------------------------------------

function loadEnvSection(
  envMap: Record<string, string>,
  yamlSection: Record<string, Partial<ServerProviderEntry>> | undefined,
): Record<string, ServerProviderEntry> {
  const result: Record<string, ServerProviderEntry> = {};

  // First, add everything from YAML as defaults
  if (yamlSection) {
    for (const [id, entry] of Object.entries(yamlSection)) {
      if (entry?.apiKey) {
        result[id] = {
          apiKey: entry.apiKey,
          baseUrl: entry.baseUrl,
          models: entry.models,
          proxy: entry.proxy,
        };
      }
    }
  }

  // Then, apply env vars (env takes priority over YAML)
  for (const [prefix, providerId] of Object.entries(envMap)) {
    const envApiKey = process.env[`${prefix}_API_KEY`] || undefined;
    const envBaseUrl = process.env[`${prefix}_BASE_URL`] || undefined;
    const envModelsStr = process.env[`${prefix}_MODELS`];
    const envModels = envModelsStr
      ? envModelsStr
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean)
      : undefined;

    if (result[providerId]) {
      // YAML entry exists — env vars override individual fields
      if (envApiKey) result[providerId].apiKey = envApiKey;
      if (envBaseUrl) result[providerId].baseUrl = envBaseUrl;
      if (envModels) result[providerId].models = envModels;
      continue;
    }

    if (!envApiKey) continue;
    result[providerId] = {
      apiKey: envApiKey,
      baseUrl: envBaseUrl,
      models: envModels,
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Module-level cache (process singleton)
// ---------------------------------------------------------------------------

const DEFAULT_FILENAME = 'server-providers.yml';

/** Cache keyed by YAML filename (empty string = default file). */
const _configs: Map<string, ServerConfig> = new Map();

function buildConfig(yamlData: YamlData): ServerConfig {
  const config: ServerConfig = {
    providers: loadEnvSection(LLM_ENV_MAP, yamlData.providers),
    tts: loadEnvSection(TTS_ENV_MAP, yamlData.tts),
    asr: loadEnvSection(ASR_ENV_MAP, yamlData.asr),
    pdf: loadEnvSection(PDF_ENV_MAP, yamlData.pdf),
    image: loadEnvSection(IMAGE_ENV_MAP, yamlData.image),
    video: loadEnvSection(VIDEO_ENV_MAP, yamlData.video),
    webSearch: loadEnvSection(WEB_SEARCH_ENV_MAP, yamlData['web-search']),
  };

  const vault = readServerProviderVaultSafely();
  applyVaultEntries(config, 'providers', vault.providers);
  applyVaultEntries(config, 'tts', vault.tts);
  applyVaultEntries(config, 'asr', vault.asr);
  applyVaultEntries(config, 'pdf', vault.pdf);
  applyVaultEntries(config, 'image', vault.image);
  applyVaultEntries(config, 'video', vault.video);
  applyVaultEntries(config, 'webSearch', vault.webSearch);

  return config;
}

function applyVaultEntries(
  config: ServerConfig,
  category: ServerProviderCategory,
  entries: Record<string, Partial<ServerProviderEntry>> | undefined,
) {
  if (!entries) return;
  const target = config[category];
  for (const [providerId, entry] of Object.entries(entries)) {
    const current = target[providerId] ?? { apiKey: '' };
    target[providerId] = {
      ...current,
      ...(entry.apiKey ? { apiKey: entry.apiKey } : {}),
      ...(entry.baseUrl ? { baseUrl: entry.baseUrl } : {}),
      ...(entry.models?.length ? { models: entry.models } : {}),
      ...(entry.proxy ? { proxy: entry.proxy } : {}),
    };
  }
}

function logConfig(config: ServerConfig, label: string): void {
  const counts = [
    Object.keys(config.providers).length,
    Object.keys(config.tts).length,
    Object.keys(config.asr).length,
    Object.keys(config.pdf).length,
    Object.keys(config.image).length,
    Object.keys(config.video).length,
    Object.keys(config.webSearch).length,
  ];
  if (counts.some((c) => c > 0)) {
    log.info(
      `[ServerProviderConfig] Loaded (${label}): ${counts[0]} LLM, ${counts[1]} TTS, ${counts[2]} ASR, ${counts[3]} PDF, ${counts[4]} Image, ${counts[5]} Video, ${counts[6]} WebSearch providers`,
    );
  }
}

function getConfig(): ServerConfig {
  const cached = _configs.get('');
  if (cached) return cached;

  const yamlData = loadYamlFile(DEFAULT_FILENAME);
  const config = buildConfig(yamlData);
  logConfig(config, DEFAULT_FILENAME);
  _configs.set('', config);
  return config;
}

export function refreshServerProviderConfig(): void {
  _configs.clear();
}

export async function ensureServerProviderConfigReady(): Promise<void> {
  await ensureServerProviderVaultReady();
  refreshServerProviderConfig();
  getConfig();
}

// ---------------------------------------------------------------------------
// Public API — LLM
// ---------------------------------------------------------------------------

/** Returns server-configured LLM providers (no apiKeys) */
export function getServerProviders(): Record<string, { models?: string[]; baseUrl?: string }> {
  const cfg = getConfig();
  const result: Record<string, { models?: string[]; baseUrl?: string }> = {};
  for (const [id, entry] of Object.entries(cfg.providers)) {
    result[id] = {};
    if (entry.models && entry.models.length > 0) result[id].models = entry.models;
    if (entry.baseUrl) result[id].baseUrl = entry.baseUrl;
  }
  return result;
}

/** Resolve API key: server key > client key (local fallback only) > empty string */
export function resolveApiKey(providerId: string, clientKey?: string): string {
  return resolveManagedSecret(getConfig().providers[providerId]?.apiKey, clientKey);
}

/** Resolve base URL: server > client (local fallback only) > undefined */
export function resolveBaseUrl(providerId: string, clientBaseUrl?: string): string | undefined {
  return resolveManagedBaseUrl(getConfig().providers[providerId]?.baseUrl, clientBaseUrl);
}

/** Resolve proxy URL for a provider (server config only) */
export function resolveProxy(providerId: string): string | undefined {
  return getConfig().providers[providerId]?.proxy;
}

// ---------------------------------------------------------------------------
// Public API — TTS
// ---------------------------------------------------------------------------

export function getServerTTSProviders(): Record<string, { baseUrl?: string }> {
  const cfg = getConfig();
  const result: Record<string, { baseUrl?: string }> = {};
  for (const [id, entry] of Object.entries(cfg.tts)) {
    result[id] = {};
    if (entry.baseUrl) result[id].baseUrl = entry.baseUrl;
  }
  return result;
}

export function resolveTTSApiKey(providerId: string, clientKey?: string): string {
  return resolveManagedSecret(getConfig().tts[providerId]?.apiKey, clientKey);
}

export function resolveTTSBaseUrl(providerId: string, clientBaseUrl?: string): string | undefined {
  return resolveManagedBaseUrl(getConfig().tts[providerId]?.baseUrl, clientBaseUrl);
}

// ---------------------------------------------------------------------------
// Public API — ASR
// ---------------------------------------------------------------------------

export function getServerASRProviders(): Record<string, { baseUrl?: string }> {
  const cfg = getConfig();
  const result: Record<string, { baseUrl?: string }> = {};
  for (const [id, entry] of Object.entries(cfg.asr)) {
    result[id] = {};
    if (entry.baseUrl) result[id].baseUrl = entry.baseUrl;
  }
  return result;
}

export function resolveASRApiKey(providerId: string, clientKey?: string): string {
  return resolveManagedSecret(getConfig().asr[providerId]?.apiKey, clientKey);
}

export function resolveASRBaseUrl(providerId: string, clientBaseUrl?: string): string | undefined {
  return resolveManagedBaseUrl(getConfig().asr[providerId]?.baseUrl, clientBaseUrl);
}

// ---------------------------------------------------------------------------
// Public API — PDF
// ---------------------------------------------------------------------------

export function getServerPDFProviders(): Record<string, { baseUrl?: string }> {
  const cfg = getConfig();
  const result: Record<string, { baseUrl?: string }> = {};
  for (const [id, entry] of Object.entries(cfg.pdf)) {
    result[id] = {};
    if (entry.baseUrl) result[id].baseUrl = entry.baseUrl;
  }
  return result;
}

export function resolvePDFApiKey(providerId: string, clientKey?: string): string {
  return resolveManagedSecret(getConfig().pdf[providerId]?.apiKey, clientKey);
}

export function resolvePDFBaseUrl(providerId: string, clientBaseUrl?: string): string | undefined {
  return resolveManagedBaseUrl(getConfig().pdf[providerId]?.baseUrl, clientBaseUrl);
}

// ---------------------------------------------------------------------------
// Public API — Image Generation
// ---------------------------------------------------------------------------

export function getServerImageProviders(): Record<string, Record<string, never>> {
  const cfg = getConfig();
  const result: Record<string, Record<string, never>> = {};
  for (const id of Object.keys(cfg.image)) {
    result[id] = {};
  }
  return result;
}

export function resolveImageApiKey(providerId: string, clientKey?: string): string {
  return resolveManagedSecret(getConfig().image[providerId]?.apiKey, clientKey);
}

export function resolveImageBaseUrl(
  providerId: string,
  clientBaseUrl?: string,
): string | undefined {
  return resolveManagedBaseUrl(getConfig().image[providerId]?.baseUrl, clientBaseUrl);
}

// ---------------------------------------------------------------------------
// Public API — Video Generation
// ---------------------------------------------------------------------------

export function getServerVideoProviders(): Record<string, Record<string, never>> {
  const cfg = getConfig();
  const result: Record<string, Record<string, never>> = {};
  for (const id of Object.keys(cfg.video)) {
    result[id] = {};
  }
  return result;
}

export function resolveVideoApiKey(providerId: string, clientKey?: string): string {
  return resolveManagedSecret(getConfig().video[providerId]?.apiKey, clientKey);
}

export function resolveVideoBaseUrl(
  providerId: string,
  clientBaseUrl?: string,
): string | undefined {
  return resolveManagedBaseUrl(getConfig().video[providerId]?.baseUrl, clientBaseUrl);
}

// ---------------------------------------------------------------------------
// Public API — Web Search (Tavily)
// ---------------------------------------------------------------------------

/** Returns server-configured web search providers (no apiKeys exposed) */
export function getServerWebSearchProviders(): Record<string, { baseUrl?: string }> {
  const cfg = getConfig();
  const result: Record<string, { baseUrl?: string }> = {};
  for (const [id, entry] of Object.entries(cfg.webSearch)) {
    result[id] = {};
    if (entry.baseUrl) result[id].baseUrl = entry.baseUrl;
  }
  return result;
}

/** Resolve Tavily API key: server key/env > client key (local fallback only) > empty */
export function resolveWebSearchApiKey(clientKey?: string): string {
  const serverKey = getConfig().webSearch.tavily?.apiKey;
  if (serverKey) return serverKey;
  return resolveManagedSecret(process.env.TAVILY_API_KEY, clientKey);
}
