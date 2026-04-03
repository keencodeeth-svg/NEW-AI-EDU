import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;

const PROVIDER_DEFAULTS = {
  zhipu: {
    requiredKeys: ["ZHIPU_API_KEY"],
    label: "智谱",
  },
  deepseek: {
    requiredKeys: ["DEEPSEEK_API_KEY"],
    label: "DeepSeek",
  },
  kimi: {
    requiredKeys: ["KIMI_API_KEY"],
    label: "Kimi",
  },
  minimax: {
    requiredKeys: ["MINIMAX_API_KEY"],
    label: "MiniMax",
  },
  seedance: {
    requiredKeys: ["SEEDANCE_API_KEY"],
    label: "Seedance",
  },
  compatible: {
    requiredKeys: ["LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL"],
    label: "OpenAI 兼容",
  },
  custom: {
    requiredKeys: ["LLM_ENDPOINT"],
    label: "自定义模型",
  },
  mock: {
    requiredKeys: [],
    label: "Mock",
  },
};

const PROVIDER_ALIASES = {
  mock: "mock",
  custom: "custom",
  compatible: "compatible",
  openai_compatible: "compatible",
  zhipu: "zhipu",
  glm: "zhipu",
  bigmodel: "zhipu",
  deepseek: "deepseek",
  kimi: "kimi",
  moonshot: "kimi",
  minimax: "minimax",
  seedance: "seedance",
  seed: "seedance",
};

function parseBooleanEnv(value) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return null;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function loadEnvFromFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const source = fs.readFileSync(filePath, "utf8");
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

function bootstrapEnv() {
  const root = process.cwd();
  loadEnvFromFile(path.join(root, ".env.local"));
  loadEnvFromFile(path.join(root, ".env"));
}

function normalizeProviderToken(value) {
  const token = String(value || "").trim().toLowerCase();
  if (!token) return null;
  return PROVIDER_ALIASES[token] ?? null;
}

function normalizeProviderChain(values) {
  const normalized = new Set();
  for (const value of values || []) {
    const token = normalizeProviderToken(value);
    if (token) normalized.add(token);
  }
  return Array.from(normalized);
}

function parseEnvProviderChain() {
  const raw = process.env.LLM_PROVIDER_CHAIN || process.env.LLM_PROVIDER || "mock";
  return normalizeProviderChain(raw.split(","));
}

function getObjectStorageRoot() {
  const configured = process.env.OBJECT_STORAGE_ROOT?.trim();
  return path.resolve(process.cwd(), configured || ".runtime-data/objects");
}

function pushItem(items, item) {
  items.push(item);
}

function summarize(items) {
  return items.reduce(
    (acc, item) => {
      acc[item.state] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 }
  );
}

function overallState(items) {
  if (items.some((item) => item.state === "fail")) return "fail";
  if (items.some((item) => item.state === "warn")) return "warn";
  return "pass";
}

function shouldEnforceRuntimeGuardrails() {
  const explicit = parseBooleanEnv(process.env.RUNTIME_GUARDRAILS_ENFORCE);
  if (explicit !== null) return explicit;
  return process.env.NODE_ENV === "production";
}

function buildRuntimeChecks(strict) {
  const checks = [];
  const guardrailIssues = [];

  if (!strict) {
    pushItem(checks, {
      key: "runtime-guardrails",
      label: "运行时守卫",
      state: "warn",
      message: "当前环境未启用严格 runtime guardrails，发布前需在 production-like 环境复核一次",
    });
  } else {
    if (!process.env.DATABASE_URL?.trim()) {
      guardrailIssues.push("DATABASE_URL 未配置");
    }
    if (parseBooleanEnv(process.env.ALLOW_JSON_FALLBACK) === true) {
      guardrailIssues.push("ALLOW_JSON_FALLBACK=true");
    }
    if (!process.env.OBJECT_STORAGE_ROOT?.trim() && parseBooleanEnv(process.env.OBJECT_STORAGE_ALLOW_DEFAULT_ROOT) !== true) {
      guardrailIssues.push("OBJECT_STORAGE_ROOT 未显式配置");
    }
    pushItem(checks, {
      key: "runtime-guardrails",
      label: "运行时守卫",
      state: guardrailIssues.length ? "fail" : "pass",
      message: guardrailIssues.length
        ? `guardrails 存在 ${guardrailIssues.length} 项问题：${guardrailIssues.join("、")}`
        : "runtime guardrails 已满足上线要求",
    });
  }

  pushItem(checks, {
    key: "database",
    label: "数据库",
    state: process.env.DATABASE_URL ? "pass" : strict ? "fail" : "warn",
    message: process.env.DATABASE_URL ? "已配置 DATABASE_URL" : "未配置 DATABASE_URL",
  });

  const root = getObjectStorageRoot();
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.accessSync(root, fs.constants.R_OK | fs.constants.W_OK);
    pushItem(checks, {
      key: "object-storage",
      label: "对象存储目录",
      state: process.env.OBJECT_STORAGE_ROOT ? "pass" : strict ? "warn" : "pass",
      message: process.env.OBJECT_STORAGE_ROOT
        ? `对象存储目录可写：${root}`
        : `对象存储目录可写，但当前使用默认路径：${root}`,
    });
  } catch (error) {
    pushItem(checks, {
      key: "object-storage",
      label: "对象存储目录",
      state: "fail",
      message: `对象存储目录不可写：${error instanceof Error ? error.message : String(error)}`,
    });
  }

  const allowJsonFallback = parseBooleanEnv(process.env.ALLOW_JSON_FALLBACK);
  pushItem(checks, {
    key: "json-fallback",
    label: "JSON fallback",
    state: allowJsonFallback === true ? (strict ? "fail" : "warn") : "pass",
    message:
      allowJsonFallback === true
        ? strict
          ? "guarded runtime 下不允许开启 JSON fallback"
          : "当前仍允许 JSON fallback，发布前建议关闭"
        : "JSON fallback 已禁用或未显式开启",
  });

  return checks;
}

function formatProviderList(values) {
  return values.length ? values.join(" -> ") : "mock";
}

function getProviderCapabilityHealth(provider, capability) {
  if (provider === "mock") {
    return {
      configured: true,
      missingEnv: [],
      model: "mock",
      baseUrl: "",
      chatPath: "",
    };
  }

  if (provider === "custom") {
    const endpoint = firstNonEmpty(process.env.LLM_ENDPOINT);
    return {
      configured: Boolean(endpoint),
      missingEnv: endpoint ? [] : ["LLM_ENDPOINT"],
      model: "custom",
      baseUrl: endpoint,
      chatPath: "",
    };
  }

  if (provider === "compatible") {
    const baseUrl = firstNonEmpty(process.env.LLM_BASE_URL);
    const apiKey = firstNonEmpty(process.env.LLM_API_KEY);
    const model = firstNonEmpty(capability === "vision" ? process.env.LLM_VISION_MODEL : "", process.env.LLM_MODEL);
    const missingEnv = [];
    if (!baseUrl) missingEnv.push("LLM_BASE_URL");
    if (!apiKey) missingEnv.push("LLM_API_KEY");
    if (!model) missingEnv.push(capability === "vision" ? "LLM_VISION_MODEL/LLM_MODEL" : "LLM_MODEL");
    return {
      configured: missingEnv.length === 0,
      missingEnv,
      model,
      baseUrl,
      chatPath: firstNonEmpty(process.env.LLM_CHAT_PATH, "/chat/completions"),
    };
  }

  const upper = provider.toUpperCase();
  const defaults = PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.mock;
  const baseUrl = firstNonEmpty(process.env[`${upper}_BASE_URL`], provider === "zhipu" ? process.env.LLM_BASE_URL : "");
  const apiKey = firstNonEmpty(process.env[`${upper}_API_KEY`], provider === "zhipu" ? process.env.LLM_API_KEY : "");
  const model = firstNonEmpty(
    capability === "vision" ? process.env[`${upper}_VISION_MODEL`] : "",
    process.env[`${upper}_MODEL`],
    provider === "zhipu" ? (capability === "vision" ? process.env.LLM_VISION_MODEL : process.env.LLM_MODEL) : "",
    capability === "vision" ? defaults.visionModel ?? defaults.model : defaults.model
  );
  const missingEnv = [];
  if (!apiKey) {
    missingEnv.push(provider === "zhipu" ? "ZHIPU_API_KEY/LLM_API_KEY" : `${upper}_API_KEY`);
  }
  if (!model) {
    missingEnv.push(
      provider === "zhipu"
        ? capability === "vision"
          ? "ZHIPU_VISION_MODEL/LLM_VISION_MODEL"
          : "ZHIPU_MODEL/LLM_MODEL"
        : capability === "vision"
          ? `${upper}_VISION_MODEL/${upper}_MODEL`
          : `${upper}_MODEL`
    );
  }
  return {
    configured: missingEnv.length === 0,
    missingEnv,
    model,
    baseUrl,
    chatPath: "/chat/completions",
  };
}

function buildAiCapabilityItem(input) {
  const effectiveChain = input.chain.length ? input.chain : ["mock"];
  const realProviders = effectiveChain.filter((provider) => provider !== "mock");
  const configuredProviders = [];
  const missingProviders = [];

  for (const provider of realProviders) {
    const health = getProviderCapabilityHealth(provider, input.capability);
    if (health.configured) {
      configuredProviders.push(PROVIDER_DEFAULTS[provider]?.label ?? provider);
    } else {
      missingProviders.push({
        provider: PROVIDER_DEFAULTS[provider]?.label ?? provider,
        missing: health.missingEnv,
      });
    }
  }

  const state = configuredProviders.length ? (missingProviders.length ? "warn" : "pass") : input.strict ? "fail" : "warn";
  const label = input.capability === "vision" ? "AI 视觉模型链" : "AI 文本模型链";
  const message = configuredProviders.length
    ? `当前链路 ${formatProviderList(effectiveChain)} 中已就绪：${configuredProviders.join(" / ")}`
    : `当前链路 ${formatProviderList(effectiveChain)} 没有可用${input.capability === "vision" ? "视觉" : "文本"}模型配置`;

  return {
    key: input.capability === "vision" ? "ai-vision" : "ai-chat",
    label,
    state,
    message,
    details: {
      configuredProviders,
      missingProviders,
    },
  };
}

async function resolveProviderConfigSource(pool) {
  const envChain = parseEnvProviderChain();
  if (!pool) {
    return {
      chain: envChain,
      source: "env",
    };
  }

  try {
    const result = await pool.query("SELECT provider_chain FROM ai_provider_runtime_config WHERE id = $1", ["runtime"]);
    const runtimeChain = normalizeProviderChain(result.rows[0]?.provider_chain ?? []);
    if (runtimeChain.length) {
      return {
        chain: runtimeChain,
        source: "runtime",
      };
    }
  } catch {
    // Swallow missing-table or local bootstrap errors and fall back to env config.
  }

  return {
    chain: envChain,
    source: "env",
  };
}

async function main() {
  bootstrapEnv();

  const args = new Set(process.argv.slice(2));
  const jsonMode = args.has("--json");
  const strict = shouldEnforceRuntimeGuardrails() || process.env.REQUIRE_DATABASE === "true";
  const items = [];
  const runtimeChecks = buildRuntimeChecks(strict);
  const runtimeSummary = summarize(runtimeChecks);
  pushItem(items, {
    key: "runtime-readiness",
    label: "运行时依赖",
    state: overallState(runtimeChecks),
    message:
      runtimeSummary.fail > 0
        ? `核心运行时检查存在 ${runtimeSummary.fail} 项失败，${runtimeSummary.warn} 项预警`
        : runtimeSummary.warn > 0
          ? `核心运行时检查通过，但仍有 ${runtimeSummary.warn} 项预警`
          : "database / object storage / runtime guardrails 已通过核心检查",
    details: {
      checks: runtimeChecks,
    },
  });

  pushItem(items, {
    key: "readiness-token",
    label: "READINESS_PROBE_TOKEN",
    state: process.env.READINESS_PROBE_TOKEN ? "pass" : strict ? "fail" : "warn",
    message: process.env.READINESS_PROBE_TOKEN
      ? "已配置发布后巡检令牌"
      : "未配置发布后巡检令牌",
  });

  pushItem(items, {
    key: "admin-step-up",
    label: "ADMIN_STEP_UP_SECRET",
    state: process.env.ADMIN_STEP_UP_SECRET ? "pass" : strict ? "fail" : "warn",
    message: process.env.ADMIN_STEP_UP_SECRET
      ? "已配置管理员二次验证密钥"
      : "未配置管理员二次验证密钥",
  });

  let pool = null;
  let providerConfig = {
    chain: parseEnvProviderChain(),
    source: "env",
  };
  if (process.env.DATABASE_URL) {
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
      });
      await pool.query("SELECT 1");
      providerConfig = await resolveProviderConfigSource(pool);
      pushItem(items, buildAiCapabilityItem({ capability: "chat", chain: providerConfig.chain, strict }));
      pushItem(items, buildAiCapabilityItem({ capability: "vision", chain: providerConfig.chain, strict }));
      const result = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
      const count = Number(result.rows[0]?.count ?? 0);
      pushItem(items, {
        key: "admin-account",
        label: "管理员账号",
        state: count > 0 ? "pass" : "fail",
        message: count > 0 ? `检测到 ${count} 个管理员账号` : "未检测到管理员账号",
      });
    } catch (error) {
      pushItem(items, {
        key: "database-probe",
        label: "数据库连通与管理员账号",
        state: "fail",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await pool?.end().catch(() => undefined);
    }
  } else {
    pushItem(items, buildAiCapabilityItem({ capability: "chat", chain: providerConfig.chain, strict }));
    pushItem(items, buildAiCapabilityItem({ capability: "vision", chain: providerConfig.chain, strict }));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    cwd: process.cwd(),
    overallState: overallState(items),
    summary: summarize(items),
    providerChain: providerConfig.chain,
    providerSource: providerConfig.source,
    strictLaunchMode: strict,
    runtimeChecks,
    items,
  };

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.overallState === "fail" ? 1 : 0;
    return;
  }

  console.log("");
  console.log("航科互动课堂上线准备报告");
  console.log(`时间: ${new Date(report.generatedAt).toLocaleString("zh-CN")}`);
  console.log(`环境: ${process.env.NODE_ENV || "development"}`);
  console.log(`AI 生效链来源: ${report.providerSource === "runtime" ? "后台运行时配置" : "环境变量"}`);
  console.log(`结论: ${report.overallState}  (pass ${report.summary.pass} / warn ${report.summary.warn} / fail ${report.summary.fail})`);
  console.log("");
  for (const item of items) {
    console.log(`[${item.state.toUpperCase()}] ${item.label} - ${item.message}`);
    if (item.key === "runtime-readiness" && Array.isArray(item.details?.checks)) {
      for (const check of item.details.checks) {
        console.log(`    - [${check.state.toUpperCase()}] ${check.label} - ${check.message}`);
      }
    }
  }
  console.log("");
  console.log("建议命令:");
  console.log("  corepack pnpm test:smoke:production-like:local");
  console.log("  corepack pnpm verify");

  process.exitCode = report.overallState === "fail" ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
