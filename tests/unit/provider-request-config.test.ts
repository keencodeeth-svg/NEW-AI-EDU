import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  getClientProviderOverride,
  getClientProviderRequestConfig,
  getClientProviderUiState,
} from '../../lib/provider-request-config';

const ORIGINAL_ALLOW = process.env.NEXT_PUBLIC_ALLOW_CLIENT_PROVIDER_SECRETS;

afterEach(() => {
  if (ORIGINAL_ALLOW === undefined) {
    delete process.env.NEXT_PUBLIC_ALLOW_CLIENT_PROVIDER_SECRETS;
  } else {
    process.env.NEXT_PUBLIC_ALLOW_CLIENT_PROVIDER_SECRETS = ORIGINAL_ALLOW;
  }
});

test('server-configured providers do not forward browser overrides', () => {
  process.env.NEXT_PUBLIC_ALLOW_CLIENT_PROVIDER_SECRETS = 'true';

  const requestConfig = getClientProviderRequestConfig({
    apiKey: 'client-secret',
    baseUrl: 'https://client.example.com/v1',
    isServerConfigured: true,
    serverBaseUrl: 'https://server.example.com/v1',
  });

  assert.deepEqual(requestConfig, {
    apiKey: '',
    baseUrl: '',
  });
  assert.equal(
    getClientProviderOverride({
      apiKey: 'client-secret',
      baseUrl: 'https://client.example.com/v1',
      isServerConfigured: true,
      serverBaseUrl: 'https://server.example.com/v1',
    }),
    undefined,
  );
});

test('client-side overrides are blocked by default for unmanaged providers', () => {
  delete process.env.NEXT_PUBLIC_ALLOW_CLIENT_PROVIDER_SECRETS;

  assert.deepEqual(
    getClientProviderRequestConfig({
      apiKey: 'client-secret',
      baseUrl: 'https://client.example.com/v1',
      isServerConfigured: false,
    }),
    {
      apiKey: '',
      baseUrl: '',
    },
  );
  assert.equal(
    getClientProviderOverride({
      apiKey: 'client-secret',
      baseUrl: 'https://client.example.com/v1',
      isServerConfigured: false,
    }),
    undefined,
  );
});

test('explicit browser opt-in re-enables client-side provider overrides', () => {
  process.env.NEXT_PUBLIC_ALLOW_CLIENT_PROVIDER_SECRETS = 'true';

  assert.deepEqual(
    getClientProviderRequestConfig({
      apiKey: 'client-secret',
      baseUrl: 'https://client.example.com/v1',
      isServerConfigured: false,
    }),
    {
      apiKey: 'client-secret',
      baseUrl: 'https://client.example.com/v1',
    },
  );
});

test('matching server base urls are not redundantly forwarded', () => {
  process.env.NEXT_PUBLIC_ALLOW_CLIENT_PROVIDER_SECRETS = 'true';

  assert.deepEqual(
    getClientProviderRequestConfig({
      apiKey: '',
      baseUrl: 'https://server.example.com/v1',
      serverBaseUrl: 'https://server.example.com/v1',
    }),
    {
      apiKey: '',
      baseUrl: '',
    },
  );
});

test('client provider ui state prefers server base url when browser overrides are disabled', () => {
  delete process.env.NEXT_PUBLIC_ALLOW_CLIENT_PROVIDER_SECRETS;

  assert.deepEqual(
    getClientProviderUiState(
      {
        apiKey: 'client-secret',
        baseUrl: 'https://client.example.com/v1',
        isServerConfigured: true,
        serverBaseUrl: 'https://server.example.com/v1',
      },
      'https://default.example.com/v1',
    ),
    {
      canEditSecrets: false,
      effectiveBaseUrl: 'https://server.example.com/v1',
      requestConfig: {
        apiKey: '',
        baseUrl: '',
      },
    },
  );
});

test('client provider ui state keeps effective client override base url when browser opt-in is enabled', () => {
  process.env.NEXT_PUBLIC_ALLOW_CLIENT_PROVIDER_SECRETS = 'true';

  assert.deepEqual(
    getClientProviderUiState(
      {
        apiKey: 'client-secret',
        baseUrl: 'https://client.example.com/v1',
        serverBaseUrl: 'https://server.example.com/v1',
      },
      'https://default.example.com/v1',
    ),
    {
      canEditSecrets: true,
      effectiveBaseUrl: 'https://client.example.com/v1',
      requestConfig: {
        apiKey: 'client-secret',
        baseUrl: 'https://client.example.com/v1',
      },
    },
  );
});

test('client provider ui state keeps server-managed providers read-only even when browser opt-in is enabled', () => {
  process.env.NEXT_PUBLIC_ALLOW_CLIENT_PROVIDER_SECRETS = 'true';

  assert.deepEqual(
    getClientProviderUiState(
      {
        apiKey: 'client-secret',
        baseUrl: 'https://client.example.com/v1',
        isServerConfigured: true,
        serverBaseUrl: 'https://server.example.com/v1',
      },
      'https://default.example.com/v1',
    ),
    {
      canEditSecrets: false,
      effectiveBaseUrl: 'https://server.example.com/v1',
      requestConfig: {
        apiKey: '',
        baseUrl: '',
      },
    },
  );
});
