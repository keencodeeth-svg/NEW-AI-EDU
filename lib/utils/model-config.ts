import { useSettingsStore } from '@/lib/store/settings';
import { getClientProviderRequestConfig } from '@/lib/provider-request-config';

/**
 * Get current model configuration from settings store
 */
export function getCurrentModelConfig() {
  const { providerId, modelId, providersConfig } = useSettingsStore.getState();
  const modelString = `${providerId}:${modelId}`;

  // Get current provider's config
  const providerConfig = providersConfig[providerId];
  const requestConfig = getClientProviderRequestConfig(providerConfig);

  return {
    providerId,
    modelId,
    modelString,
    apiKey: requestConfig.apiKey,
    baseUrl: requestConfig.baseUrl,
    providerType: providerConfig?.type,
    requiresApiKey: providerConfig?.requiresApiKey,
    isServerConfigured: providerConfig?.isServerConfigured,
  };
}
