import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Playwright123!";
const TEACHER_INVITE_CODE = "PW-TEACH-2026";
const INCLUDE_SERIOUS_VIOLATIONS = process.env.PLAYWRIGHT_A11Y_INCLUDE_SERIOUS === "true";

type ApiResult<T = unknown> = {
  ok: boolean;
  status: number;
  body: T;
};

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function postJson<T>(page: Page, url: string, body: unknown): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ requestUrl, requestBody }) => {
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-origin": window.location.origin
        },
        body: JSON.stringify(requestBody)
      });
      const payload = await response.json().catch(() => null);
      return {
        ok: response.ok,
        status: response.status,
        body: payload
      };
    },
    { requestUrl: url, requestBody: body }
  );
}

function formatViolations(
  label: string,
  violations: Array<{ id: string; impact?: string | null; nodes: Array<{ target: unknown[] }> }>
) {
  return [
    `${label} 存在 ${violations.length} 个严重无障碍问题：`,
    ...violations.map((violation) => {
      const targets = violation.nodes
        .slice(0, 3)
        .map((node) => node.target.map((item) => String(item)).join(" "))
        .join(" | ");
      return `${violation.impact ?? "unknown"} ${violation.id}: ${targets}`;
    })
  ].join("\n");
}

async function expectNoCriticalViolations(page: Page, label: string) {
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const blockedImpacts = INCLUDE_SERIOUS_VIOLATIONS ? new Set(["critical", "serious"]) : new Set(["critical"]);
  const blockedViolations = results.violations.filter((violation) => blockedImpacts.has(violation.impact ?? ""));
  expect(blockedViolations, formatViolations(label, blockedViolations)).toEqual([]);
}

async function expectSkipLinkKeyboardReachable(page: Page) {
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "跳转到主内容" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("#main-content");
  await expect(page.locator("#main-content")).toBeVisible();
}

async function expectThemeToggleAria(page: Page) {
  const themeToggle = page.locator(".theme-mode-toggle");
  await expect(themeToggle).toHaveAttribute("role", "group");
  await expect(themeToggle).toHaveAttribute("aria-label", /外观模式/);

  const lightButton = page.getByRole("button", { name: "切换到浅色模式" });
  const darkButton = page.getByRole("button", { name: "切换到暗色模式" });
  const systemButton = page.getByRole("button", { name: "跟随系统外观" });

  await expect(lightButton).toHaveAttribute("aria-pressed", /true|false/);
  await expect(darkButton).toHaveAttribute("aria-pressed", /true|false/);
  await expect(systemButton).toHaveAttribute("aria-pressed", /true|false/);
}

async function registerStudent(page: Page, params: { email: string; name: string; grade?: string }) {
  const result = await postJson(page, "/api/auth/register", {
    role: "student",
    email: params.email,
    password: PASSWORD,
    name: params.name,
    grade: params.grade ?? "4"
  });
  expect(result.ok, `student registration failed: ${result.status}`).toBe(true);
}

async function registerTeacherByApi(page: Page, params: { email: string; name: string; schoolCode?: string }) {
  const result = await postJson(page, "/api/auth/teacher-register", {
    email: params.email,
    password: PASSWORD,
    name: params.name,
    inviteCode: TEACHER_INVITE_CODE,
    schoolCode: params.schoolCode
  });
  expect(result.ok, `teacher registration failed: ${result.status}`).toBe(true);
}

async function loginByApi(page: Page, params: { email: string; role: "student" | "teacher" }) {
  const result = await postJson(page, "/api/auth/login", {
    email: params.email,
    password: PASSWORD,
    role: params.role
  });
  expect(result.ok, `${params.role} login failed: ${result.status}`).toBe(true);
}

async function dismissGuidedTourIfVisible(page: Page) {
  const skipButton = page.getByRole("button", { name: "跳过" });
  if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click();
    await page.waitForLoadState("networkidle");
  }
}

test.describe("browser accessibility", () => {
  test("public entry pages have no critical accessibility violations", async ({ page }) => {
    await page.goto("/");
    await expectSkipLinkKeyboardReachable(page);
    await expectThemeToggleAria(page);
    await expectNoCriticalViolations(page, "首页");

    await page.goto("/login");
    await expectSkipLinkKeyboardReachable(page);
    await expectThemeToggleAria(page);
    await expectNoCriticalViolations(page, "登录页");
  });

  test("student dashboard and practice flow keep critical accessibility issues at zero", async ({ page }) => {
    const studentEmail = `${uniqueId("a11y-student")}@local.test`;

    await page.goto("/login?role=student");
    await registerStudent(page, {
      email: studentEmail,
      name: "A11y Student"
    });
    await loginByApi(page, {
      email: studentEmail,
      role: "student"
    });

    await page.goto("/student");
    await dismissGuidedTourIfVisible(page);
    await expect(page.getByRole("heading", { name: "今天直接开始" })).toBeVisible({ timeout: 15_000 });
    await expectThemeToggleAria(page);
    await expect(page.locator(".app-sidebar")).toBeVisible();
    await expect(page.locator(".public-header-links")).toHaveCount(0);
    await expectNoCriticalViolations(page, "学生首页");

    await page.goto("/practice");
    await expect(page.getByRole("heading", { name: "智能练习" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".main")).toHaveAttribute("id", "main-content");
    await expectNoCriticalViolations(page, "练习页");
  });

  test("teacher dashboard and classroom live pages have no critical accessibility violations", async ({ page }) => {
    const teacherEmail = `${uniqueId("a11y-teacher")}@local.test`;

    await page.goto("/login?role=teacher");
    await registerTeacherByApi(page, {
      email: teacherEmail,
      name: "A11y Teacher"
    });
    await loginByApi(page, {
      email: teacherEmail,
      role: "teacher"
    });

    await page.goto("/teacher");
    await dismissGuidedTourIfVisible(page);
    await expect(page.getByRole("heading", { name: "现在先开工" })).toBeVisible({ timeout: 15_000 });
    await expectThemeToggleAria(page);
    await expect(page.locator(".app-sidebar")).toBeVisible();
    await expect(page.locator(".public-header-links")).toHaveCount(0);
    await expectNoCriticalViolations(page, "教师首页");

    await page.goto("/teacher/classroom-live");
    await expect(page.getByRole("heading", { name: "课堂实时仪表盘" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".main")).toHaveAttribute("id", "main-content");
    await expectNoCriticalViolations(page, "课堂实时仪表盘");
  });
});
