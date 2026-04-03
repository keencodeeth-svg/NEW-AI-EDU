import {
  getEffectiveAiProviderChain,
  getEnvAiProviderChain,
  getRuntimeAiProviderConfig,
  refreshRuntimeAiProviderConfig,
} from "./ai-config";
import { getLlmProviderHealth, type LlmProviderCapabilityHealth } from "./ai-provider";
import { isDbEnabled, queryOne } from "./db";
import { getReadinessPayload, type ReadinessPayload } from "./health";
import { shouldEnforceRuntimeGuardrails } from "./runtime-guardrails";

export type LaunchReadinessState = "pass" | "warn" | "fail";

export type LaunchReadinessItem = {
  key: string;
  label: string;
  state: LaunchReadinessState;
  message: string;
  action?: string;
  details?: Record<string, unknown>;
};

export type LaunchReadinessSummary = {
  pass: number;
  warn: number;
  fail: number;
};

export type LaunchReadinessReport = {
  generatedAt: string;
  environment: string;
  strictLaunchMode: boolean;
  overallState: LaunchReadinessState;
  summary: LaunchReadinessSummary;
  providerChain: string[];
  providerSource: "runtime" | "env";
  readiness: ReadinessPayload;
  items: LaunchReadinessItem[];
};

type CapabilitySummary = {
  state: LaunchReadinessState;
  message: string;
  details: Record<string, unknown>;
};

function getStrictLaunchMode() {
  return process.env.NODE_ENV === "production" || shouldEnforceRuntimeGuardrails();
}

function formatProviderList(values: string[]) {
  return values.length ? values.join(" -> ") : "mock";
}

function getCapabilityHealthSummary(
  capabilityLabel: "chat" | "vision",
  chain: string[],
  healthRows: Array<{ provider: string; chat: LlmProviderCapabilityHealth; vision: LlmProviderCapabilityHealth }>,
  strict: boolean
): CapabilitySummary {
  const effectiveChain = chain.length ? chain : ["mock"];
  const realProviders = effectiveChain.filter((provider) => provider !== "mock");
  const configuredProviders = healthRows
    .filter((row) => realProviders.includes(row.provider) && row[capabilityLabel].configured)
    .map((row) => row.provider);
  const missingProviders = healthRows
    .filter((row) => realProviders.includes(row.provider) && !row[capabilityLabel].configured)
    .map((row) => ({
      provider: row.provider,
      missingEnv: row[capabilityLabel].missingEnv,
    }));
  const firstProvider = effectiveChain[0] ?? "mock";
  const firstProviderHealth = healthRows.find((row) => row.provider === firstProvider);
  const firstProviderConfigured =
    firstProvider === "mock"
      ? false
      : Boolean(firstProviderHealth?.[capabilityLabel].configured);

  if (!configuredProviders.length) {
    return {
      state: strict ? "fail" : "warn",
      message:
        capabilityLabel === "chat"
          ? `当前生效链 ${formatProviderList(effectiveChain)} 未配置可用文本模型`
          : `当前生效链 ${formatProviderList(effectiveChain)} 未配置可用视觉模型`,
      details: {
        chain: effectiveChain,
        configuredProviders,
        missingProviders,
      },
    };
  }

  if (!firstProviderConfigured && configuredProviders.length) {
    return {
      state: "warn",
      message:
        capabilityLabel === "chat"
          ? `主用文本模型未就绪，当前将依赖后备链 ${configuredProviders.join(" / ")}`
          : `主用视觉模型未就绪，当前将依赖后备链 ${configuredProviders.join(" / ")}`,
      details: {
        chain: effectiveChain,
        configuredProviders,
        missingProviders,
      },
    };
  }

  return {
    state: "pass",
    message:
      capabilityLabel === "chat"
        ? `文本生成链可用：${configuredProviders.join(" / ")}`
        : `视觉生成链可用：${configuredProviders.join(" / ")}`,
    details: {
      chain: effectiveChain,
      configuredProviders,
      missingProviders,
    },
  };
}

export function summarizeLaunchReadinessItems(items: LaunchReadinessItem[]): LaunchReadinessSummary {
  return items.reduce<LaunchReadinessSummary>(
    (acc, item) => {
      acc[item.state] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 }
  );
}

export function resolveLaunchReadinessOverallState(items: LaunchReadinessItem[]): LaunchReadinessState {
  if (items.some((item) => item.state === "fail")) return "fail";
  if (items.some((item) => item.state === "warn")) return "warn";
  return "pass";
}

async function checkAdminAccount(strict: boolean): Promise<LaunchReadinessItem> {
  if (!isDbEnabled()) {
    return {
      key: "admin-account",
      label: "管理员账号",
      state: strict ? "fail" : "warn",
      message: "数据库未配置，无法确认管理员账号是否可登录",
      action: "先完成 DATABASE_URL、迁移和种子初始化，再确认管理员账号可用。",
      details: {
        databaseConfigured: false,
      },
    };
  }

  try {
    const row = await queryOne<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'"
    );
    const count = Number(row?.count ?? 0);
    if (count > 0) {
      return {
        key: "admin-account",
        label: "管理员账号",
        state: "pass",
        message: `已发现 ${count} 个管理员账号，可用于后台治理与上线巡检`,
        details: {
          count,
        },
      };
    }
    return {
      key: "admin-account",
      label: "管理员账号",
      state: "fail",
      message: "当前没有可用管理员账号，上线后将无法进入模型中心和治理后台",
      action: "使用管理员注册码完成首个管理员账号初始化，或配置 ADMIN_BOOTSTRAP_*。",
      details: {
        count,
      },
    };
  } catch (error) {
    return {
      key: "admin-account",
      label: "管理员账号",
      state: strict ? "fail" : "warn",
      message: "管理员账号检查失败",
      action: "先完成数据库迁移，再确认 users 表和管理员账号已经就绪。",
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function checkSecretConfig(input: {
  key: string;
  label: string;
  envName: string;
  successMessage: string;
  missingMessage: string;
  action: string;
  strict: boolean;
}): LaunchReadinessItem {
  const configured = Boolean(process.env[input.envName]?.trim());
  return {
    key: input.key,
    label: input.label,
    state: configured ? "pass" : input.strict ? "fail" : "warn",
    message: configured ? input.successMessage : input.missingMessage,
    action: configured ? undefined : input.action,
    details: {
      envName: input.envName,
      configured,
    },
  };
}

function buildReadinessSummaryItem(readiness: ReadinessPayload): LaunchReadinessItem {
  if (readiness.ready) {
    return {
      key: "runtime-readiness",
      label: "运行时依赖",
      state: readiness.summary.warn > 0 ? "warn" : "pass",
      message:
        readiness.summary.warn > 0
          ? `readiness 通过，但仍有 ${readiness.summary.warn} 项预警`
          : "database / object storage / runtime guardrails 已通过 readiness 检查",
      action:
        readiness.summary.warn > 0
          ? "继续收敛 warn 项，确保 staging / production 发布后不带隐患。"
          : undefined,
      details: readiness.summary,
    };
  }

  return {
    key: "runtime-readiness",
    label: "运行时依赖",
    state: "fail",
    message: `readiness 未通过：${readiness.summary.fail} 项失败，${readiness.summary.warn} 项预警`,
    action: "先处理下方 database / object storage / runtime guardrails 的失败项，再推进上线。",
    details: readiness.summary,
  };
}

export async function getLaunchReadinessReport(): Promise<LaunchReadinessReport> {
  const strict = getStrictLaunchMode();

  if (isDbEnabled()) {
    await refreshRuntimeAiProviderConfig();
  }

  const readiness = await getReadinessPayload();
  const runtimeConfig = getRuntimeAiProviderConfig();
  const envChain = getEnvAiProviderChain();
  const providerChain = getEffectiveAiProviderChain();
  const providerSource = runtimeConfig.providerChain.length ? "runtime" : "env";
  const providerHealth = getLlmProviderHealth({ providers: providerChain });

  const chatSummary = getCapabilityHealthSummary("chat", providerChain, providerHealth, strict);
  const visionSummary = getCapabilityHealthSummary("vision", providerChain, providerHealth, strict);

  const items: LaunchReadinessItem[] = [
    buildReadinessSummaryItem(readiness),
    {
      key: "ai-chat",
      label: "文本模型链",
      state: chatSummary.state,
      message: chatSummary.message,
      action:
        chatSummary.state === "pass"
          ? undefined
          : "去管理端 /admin/ai-models 或环境变量里补齐主用文本模型链，避免课堂生成与题目生成失效。",
      details: chatSummary.details,
    },
    {
      key: "ai-vision",
      label: "视觉模型链",
      state: visionSummary.state,
      message: visionSummary.message,
      action:
        visionSummary.state === "pass"
          ? undefined
          : "如果要上线题图理解、图像辅助理解或多模态流程，需补齐至少一个可用视觉模型。",
      details: visionSummary.details,
    },
    checkSecretConfig({
      key: "readiness-token",
      label: "健康探针令牌",
      envName: "READINESS_PROBE_TOKEN",
      successMessage: "已配置 READINESS_PROBE_TOKEN，可安全接入发布后巡检",
      missingMessage: "未配置 READINESS_PROBE_TOKEN，staging / production 的自动巡检链路不完整",
      action: "为 staging / production 配置 READINESS_PROBE_TOKEN，并仅通过请求头访问 readiness。",
      strict,
    }),
    checkSecretConfig({
      key: "admin-step-up",
      label: "管理员二次验证",
      envName: "ADMIN_STEP_UP_SECRET",
      successMessage: "已配置管理员二次验证密钥，高风险后台操作可受控执行",
      missingMessage: "未配置 ADMIN_STEP_UP_SECRET，高风险后台操作缺少上线级安全兜底",
      action: "配置 ADMIN_STEP_UP_SECRET，确保管理员高风险操作需要二次验证。",
      strict,
    }),
    await checkAdminAccount(strict),
  ];

  return {
    generatedAt: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    strictLaunchMode: strict,
    overallState: resolveLaunchReadinessOverallState(items),
    summary: summarizeLaunchReadinessItems(items),
    providerChain,
    providerSource,
    readiness,
    items: items.map((item) => ({
      ...item,
      details:
        item.key === "ai-chat" || item.key === "ai-vision"
          ? {
              ...item.details,
              envChain,
              providerSource,
            }
          : item.details,
    })),
  };
}
