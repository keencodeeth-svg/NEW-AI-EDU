/**
 * Web Search API
 *
 * POST /api/web-search
 * Simple JSON request/response using Tavily search.
 */

import { searchWithTavily, formatSearchResultsAsContext } from '@/lib/web-search/tavily';
import {
  getBlockedClientProviderSecretMessage,
  hasClientProviderSecretOverride,
  resolveWebSearchApiKey,
  shouldAllowClientProviderSecrets,
} from '@/lib/server/provider-config';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';

const log = createLogger('WebSearch');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, apiKey: clientApiKey } = body as {
      query?: string;
      apiKey?: string;
    };

    if (!query || !query.trim()) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'query is required');
    }

    if (
      hasClientProviderSecretOverride({
        apiKey: clientApiKey,
      }) &&
      !shouldAllowClientProviderSecrets()
    ) {
      return apiError('INVALID_REQUEST', 403, getBlockedClientProviderSecretMessage());
    }

    const apiKey = resolveWebSearchApiKey(clientApiKey);
    if (!apiKey) {
      return apiError(
        'MISSING_API_KEY',
        400,
        'Tavily API key is not configured. 请在管理后台的 AI Provider Vault 中统一配置密钥。 也可以通过服务端环境变量 TAVILY_API_KEY 提供。',
      );
    }

    const result = await searchWithTavily({ query: query.trim(), apiKey });
    const context = formatSearchResultsAsContext(result);

    return apiSuccess({
      answer: result.answer,
      sources: result.sources,
      context,
      query: result.query,
      responseTime: result.responseTime,
    });
  } catch (err) {
    log.error('[WebSearch] Error:', err);
    const message = err instanceof Error ? err.message : 'Web search failed';
    return apiError('INTERNAL_ERROR', 500, message);
  }
}
