import { NextRequest } from 'next/server';
import { createLogger } from '@/lib/logger';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  getBlockedClientProviderSecretMessage,
  hasClientProviderSecretOverride,
  resolveTTSApiKey,
  resolveTTSBaseUrl,
  shouldAllowClientProviderSecrets,
} from '@/lib/server/provider-config';
const log = createLogger('Azure Voices');

export const maxDuration = 30;

/**
 * Azure TTS Voice List API
 * Fetches available voices from Azure Speech Services
 */
export async function POST(req: NextRequest) {
  try {
    const { apiKey, baseUrl } = await req.json();

    const clientBaseUrl = baseUrl || undefined;

    // Validate baseUrl against SSRF
    if (clientBaseUrl && process.env.NODE_ENV === 'production') {
      const ssrfError = validateUrlForSSRF(clientBaseUrl);
      if (ssrfError) {
        return apiError('INVALID_URL', 403, ssrfError);
      }
    }

    if (
      hasClientProviderSecretOverride({
        apiKey,
        baseUrl: clientBaseUrl,
      }) &&
      !shouldAllowClientProviderSecrets()
    ) {
      return apiError('INVALID_REQUEST', 403, getBlockedClientProviderSecretMessage());
    }

    const resolvedApiKey = resolveTTSApiKey('azure-tts', apiKey || undefined);
    if (!resolvedApiKey) {
      return apiError('MISSING_API_KEY', 400, 'API Key is required');
    }

    const resolvedBaseUrl = resolveTTSBaseUrl('azure-tts', clientBaseUrl);
    if (!resolvedBaseUrl) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Base URL is required');
    }

    // Call Azure voices list endpoint; disable redirect following to prevent SSRF via redirect
    const response = await fetch(`${resolvedBaseUrl}/cognitiveservices/voices/list`, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': resolvedApiKey,
      },
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      return apiError('REDIRECT_NOT_ALLOWED', 403, 'Redirects are not allowed');
    }

    if (!response.ok) {
      const errorText = await response.text();
      return apiError(
        'UPSTREAM_ERROR',
        response.status,
        'Failed to fetch voices from Azure',
        errorText || response.statusText,
      );
    }

    const voices = await response.json();

    return apiSuccess({ voices });
  } catch (error) {
    log.error('API error:', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to fetch voices',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}
