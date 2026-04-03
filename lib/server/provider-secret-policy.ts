import { shouldEnforceRuntimeGuardrails } from "../runtime-guardrails";

const PROVIDER_VAULT_HINT = "请在管理后台的 AI Provider Vault 中统一配置密钥。";

function cleanOptionalString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseBooleanFlag(value: string | undefined) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return null;
}

export function shouldAllowClientProviderSecrets() {
  const explicit = parseBooleanFlag(process.env.ALLOW_CLIENT_PROVIDER_SECRETS);
  if (explicit !== null) return explicit;
  return process.env.NODE_ENV !== "production" && !shouldEnforceRuntimeGuardrails();
}

export function getProviderVaultHint() {
  return PROVIDER_VAULT_HINT;
}

export function hasClientProviderSecretOverride(params: {
  apiKey?: string | null;
  baseUrl?: string | null;
}) {
  return Boolean(cleanOptionalString(params.apiKey) || cleanOptionalString(params.baseUrl));
}

export function getBlockedClientProviderSecretMessage() {
  return `当前环境不允许从客户端覆盖 Provider API Key 或 Base URL。${getProviderVaultHint()}`;
}

export function resolveManagedSecret(serverValue?: string, clientValue?: string) {
  const serverSecret = cleanOptionalString(serverValue);
  if (serverSecret) return serverSecret;
  if (!shouldAllowClientProviderSecrets()) return "";
  return cleanOptionalString(clientValue) || "";
}

export function resolveManagedBaseUrl(serverValue?: string, clientValue?: string) {
  const serverBaseUrl = cleanOptionalString(serverValue);
  if (serverBaseUrl) return serverBaseUrl;
  if (!shouldAllowClientProviderSecrets()) return undefined;
  return cleanOptionalString(clientValue);
}
