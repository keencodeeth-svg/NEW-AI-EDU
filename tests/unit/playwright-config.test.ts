import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPlaywrightWebServerEnv } from "../../playwright.config";

test("default Playwright browser tests isolate from local DATABASE_URL", () => {
  const env = buildPlaywrightWebServerEnv(
    {
      DATABASE_URL: undefined,
      REQUIRE_DATABASE: undefined,
      ALLOW_JSON_FALLBACK: undefined,
      RUNTIME_GUARDRAILS_ENFORCE: undefined
    },
    { productionLike: false }
  );

  assert.equal(env.DATABASE_URL, "");
  assert.equal(env.REQUIRE_DATABASE, "false");
  assert.equal(env.ALLOW_JSON_FALLBACK, "true");
  assert.equal(env.RUNTIME_GUARDRAILS_ENFORCE, "false");
});

test("production-like Playwright browser tests keep database-only runtime contract", () => {
  const env = buildPlaywrightWebServerEnv(
    {
      DATABASE_URL: "postgres://demo:demo@localhost:5432/demo",
      REQUIRE_DATABASE: undefined,
      ALLOW_JSON_FALLBACK: undefined,
      RUNTIME_GUARDRAILS_ENFORCE: undefined
    },
    { productionLike: true }
  );

  assert.equal(env.DATABASE_URL, "postgres://demo:demo@localhost:5432/demo");
  assert.equal(env.REQUIRE_DATABASE, "true");
  assert.equal(env.ALLOW_JSON_FALLBACK, "false");
  assert.equal(env.RUNTIME_GUARDRAILS_ENFORCE, "true");
});
