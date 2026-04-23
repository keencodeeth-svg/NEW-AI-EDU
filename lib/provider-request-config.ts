export interface SecretAwareProviderConfig {
  apiKey?: string | null;
  baseUrl?: string | null;
  isServerConfigured?: boolean;
  serverBaseUrl?: string | null;
}

export interface ClientProviderUiState {
  canEditSecrets: boolean;
  effectiveBaseUrl: string;
  requestConfig: {
    apiKey: string;
    baseUrl: string;
  };
}

function cleanOptionalString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : '';
}

function parseBooleanFlag(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(normalized);
}

export function shouldAllowClientProviderSecretsInBrowser() {
  return parseBooleanFlag(process.env.NEXT_PUBLIC_ALLOW_CLIENT_PROVIDER_SECRETS);
}

/**
 * Build the client-side provider override payload that is safe to forward to
 * server routes. Browser-side provider overrides are disabled by default so
 * production-style behavior matches the backend vault policy unless a public
 * opt-in flag is explicitly enabled for controlled local debugging.
 */
export function getClientProviderRequestConfig(config?: SecretAwareProviderConfig | null) {
  const isServerConfigured = Boolean(config?.isServerConfigured);
  const serverBaseUrl = cleanOptionalString(config?.serverBaseUrl);
  const clientBaseUrl = cleanOptionalString(config?.baseUrl);

  if (isServerConfigured || !shouldAllowClientProviderSecretsInBrowser()) {
    return {
      apiKey: '',
      baseUrl: '',
    };
  }

  return {
    apiKey: cleanOptionalString(config?.apiKey),
    baseUrl: clientBaseUrl === serverBaseUrl ? '' : clientBaseUrl,
  };
}

export function getClientProviderOverride(config?: SecretAwareProviderConfig | null) {
  const requestConfig = getClientProviderRequestConfig(config);
  if (!requestConfig.apiKey && !requestConfig.baseUrl) {
    return undefined;
  }

  return {
    ...(requestConfig.apiKey ? { apiKey: requestConfig.apiKey } : {}),
    ...(requestConfig.baseUrl ? { baseUrl: requestConfig.baseUrl } : {}),
  };
}

export function getClientProviderUiState(
  config?: SecretAwareProviderConfig | null,
  defaultBaseUrl?: string | null,
): ClientProviderUiState {
  const isServerConfigured = Boolean(config?.isServerConfigured);
  const requestConfig = getClientProviderRequestConfig(config);

  return {
    canEditSecrets: shouldAllowClientProviderSecretsInBrowser() && !isServerConfigured,
    effectiveBaseUrl:
      requestConfig.baseUrl ||
      cleanOptionalString(config?.serverBaseUrl) ||
      cleanOptionalString(defaultBaseUrl),
    requestConfig,
  };
}
