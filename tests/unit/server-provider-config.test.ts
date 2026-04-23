import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { setEnvValue, unsetEnvValue } from "./env-test-helpers";
import {
  getBlockedClientProviderSecretMessage,
  getProviderVaultHint,
  hasClientProviderSecretOverride,
  resolveManagedBaseUrl,
  resolveManagedSecret,
  shouldAllowClientProviderSecrets
} from "../../lib/server/provider-secret-policy";

const ENV_KEYS = [
  "ALLOW_CLIENT_PROVIDER_SECRETS",
  "NODE_ENV",
  "OPENAI_API_KEY",
  "RUNTIME_GUARDRAILS_ENFORCE",
  "TAVILY_API_KEY"
] as const;

const ORIGINAL_ENV = new Map<string, string | undefined>(ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV.get(key);
    if (value === undefined) {
      unsetEnvValue(key);
    } else {
      setEnvValue(key, value);
    }
  }
}

function setEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  restoreEnv();
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      unsetEnvValue(key);
    } else {
      setEnvValue(key, value);
    }
  }
}

afterEach(() => {
  restoreEnv();
});

test("server-managed provider keys take precedence over browser-provided keys", () => {
  setEnv({
    ALLOW_CLIENT_PROVIDER_SECRETS: "true",
    NODE_ENV: "development",
    OPENAI_API_KEY: "server-openai-key",
    RUNTIME_GUARDRAILS_ENFORCE: undefined
  });

  assert.equal(resolveManagedSecret("server-openai-key", "client-openai-key"), "server-openai-key");
  assert.equal(resolveManagedBaseUrl(undefined, "https://client.example.com/v1"), "https://client.example.com/v1");
});

test("guarded runtime blocks browser-provided provider secrets", () => {
  setEnv({
    NODE_ENV: "production",
    OPENAI_API_KEY: undefined,
    RUNTIME_GUARDRAILS_ENFORCE: "true",
    TAVILY_API_KEY: undefined
  });

  assert.equal(shouldAllowClientProviderSecrets(), false);
  assert.equal(
    hasClientProviderSecretOverride({
      apiKey: "client-openai-key",
      baseUrl: undefined,
    }),
    true,
  );
  assert.equal(resolveManagedSecret(undefined, "client-openai-key"), "");
  assert.equal(resolveManagedBaseUrl(undefined, "https://client.example.com/v1"), undefined);
  assert.equal(resolveManagedSecret(process.env.TAVILY_API_KEY, "client-tavily-key"), "");
  assert.match(getProviderVaultHint(), /AI Provider Vault/);
  assert.match(getBlockedClientProviderSecretMessage(), /AI Provider Vault/);
});

test("browser-provided provider secrets stay blocked by default even in local development", () => {
  setEnv({
    NODE_ENV: "development",
    OPENAI_API_KEY: undefined,
    RUNTIME_GUARDRAILS_ENFORCE: undefined,
    TAVILY_API_KEY: undefined
  });

  assert.equal(shouldAllowClientProviderSecrets(), false);
  assert.equal(resolveManagedSecret(undefined, "client-openai-key"), "");
  assert.equal(resolveManagedBaseUrl(undefined, "https://client.example.com/v1"), undefined);
  assert.equal(resolveManagedSecret(process.env.TAVILY_API_KEY, "client-tavily-key"), "");
});

test("explicit flag can re-enable browser-provided provider secrets for controlled environments", () => {
  setEnv({
    ALLOW_CLIENT_PROVIDER_SECRETS: "true",
    NODE_ENV: "production",
    OPENAI_API_KEY: undefined,
    RUNTIME_GUARDRAILS_ENFORCE: "true"
  });

  assert.equal(shouldAllowClientProviderSecrets(), true);
  assert.equal(resolveManagedSecret(undefined, "client-openai-key"), "client-openai-key");
});
