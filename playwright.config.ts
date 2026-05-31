import { defineConfig } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const IS_PRODUCTION_LIKE = process.env.PLAYWRIGHT_FORCE_PRODUCTION_LIKE === "true";

function compactEnv(input: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

export function buildPlaywrightWebServerEnv(
  input: Record<string, string | undefined> = process.env,
  options: { productionLike?: boolean } = {}
) {
  const productionLike = options.productionLike ?? input.PLAYWRIGHT_FORCE_PRODUCTION_LIKE === "true";
  return compactEnv({
    ADMIN_INVITE_CODE: input.ADMIN_INVITE_CODE ?? "PW-ADMIN-2026",
    API_TEST_SCOPE: input.API_TEST_SCOPE ?? "playwright",
    API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER: input.API_TEST_ALLOW_CUSTOM_ORIGIN_HEADER ?? "true",
    ALLOW_JSON_FALLBACK: input.ALLOW_JSON_FALLBACK ?? (productionLike ? "false" : "true"),
    DATA_DIR: input.DATA_DIR ?? ".runtime-data/playwright",
    DATA_SEED_DIR: input.DATA_SEED_DIR,
    DATABASE_URL: input.DATABASE_URL ?? (productionLike ? undefined : ""),
    DB_SSL: input.DB_SSL,
    FILE_INLINE_CONTENT: input.FILE_INLINE_CONTENT ?? "false",
    FILE_OBJECT_STORAGE_ENABLED: input.FILE_OBJECT_STORAGE_ENABLED ?? "true",
    LIBRARY_INLINE_FILE_CONTENT: input.LIBRARY_INLINE_FILE_CONTENT ?? "false",
    LIBRARY_OBJECT_STORAGE_ENABLED: input.LIBRARY_OBJECT_STORAGE_ENABLED ?? "true",
    OBJECT_STORAGE_ROOT: input.OBJECT_STORAGE_ROOT ?? ".runtime-data/playwright-objects",
    READINESS_PROBE_TOKEN: input.READINESS_PROBE_TOKEN,
    REQUIRE_DATABASE: input.REQUIRE_DATABASE ?? (productionLike ? "true" : "false"),
    RUNTIME_GUARDRAILS_ENFORCE: input.RUNTIME_GUARDRAILS_ENFORCE ?? (productionLike ? "true" : "false"),
    SCHOOL_ADMIN_INVITE_CODE: input.SCHOOL_ADMIN_INVITE_CODE ?? "PW-SCHOOL-2026",
    TEACHER_INVITE_CODES: input.TEACHER_INVITE_CODES ?? "PW-TEACH-2026"
  });
}

const webServerEnv = buildPlaywrightWebServerEnv(process.env, {
  productionLike: IS_PRODUCTION_LIKE
});

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["line"]] : [["line"]],
  projects: [
    {
      name: process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === "true" ? "chrome-smoke" : "chromium-smoke",
      use:
        process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === "true"
          ? { browserName: "chromium", channel: "chrome" }
          : { browserName: "chromium" }
    }
  ],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off"
  },
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "true",
    timeout: 120_000,
    env: webServerEnv
  }
});
