export interface SecretAwareProviderConfig {
  apiKey?: string | null;
  baseUrl?: string | null;
  isServerConfigured?: boolean;
  serverBaseUrl?: string | null;
}

function cleanOptionalString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : "";
}

/**
 * Build the client-side provider override payload that is safe to forward to
 * server routes. When a provider is already managed by the server vault, the
 * browser should not keep sending secrets or custom base URLs back upstream.
 */
export function getClientProviderRequestConfig(config?: SecretAwareProviderConfig | null) {
  const isServerConfigured = Boolean(config?.isServerConfigured);
  const serverBaseUrl = cleanOptionalString(config?.serverBaseUrl);
  const clientBaseUrl = cleanOptionalString(config?.baseUrl);

  if (isServerConfigured) {
    return {
      apiKey: "",
      baseUrl: "",
    };
  }

  return {
    apiKey: cleanOptionalString(config?.apiKey),
    baseUrl: clientBaseUrl === serverBaseUrl ? "" : clientBaseUrl,
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
