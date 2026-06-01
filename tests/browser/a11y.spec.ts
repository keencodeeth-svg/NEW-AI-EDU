import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { isBlockedA11yImpact } from "./a11y-policy";

const PASSWORD = "Playwright123!";
const TEACHER_INVITE_CODE = "PW-TEACH-2026";

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
  const blockedViolations = results.violations.filter((violation) => isBlockedA11yImpact(violation.impact));
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

function getSelectedRoleRadio(page: Page, label: string) {
  return page.locator('[role="radio"][aria-checked="true"]').filter({
    has: page.locator(".role-title", { hasText: new RegExp(`^${label}$`) })
  });
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
    await expect(page.getByText("先用学生主入口理解平台主线")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "学生登录" })).toHaveAttribute("href", "/login?role=student&entry=landing");
    await expect(page.getByRole("link", { name: "教师登录" })).toHaveAttribute("href", "/login?role=teacher&entry=landing");
    await expect(page.getByRole("link", { name: "家长登录" })).toHaveAttribute("href", "/login?role=parent&entry=landing");
    await expect(page.getByRole("link", { name: "学校登录" })).toHaveAttribute(
      "href",
      "/login?role=school_admin&entry=landing"
    );
    await expectNoCriticalViolations(page, "首页");

    await page.goto("/login");
    await expectSkipLinkKeyboardReachable(page);
    await expectThemeToggleAria(page);
    await expect(page.getByLabel("邮箱")).not.toHaveAttribute("placeholder", /demo\.com/i);
    await expect(page.getByLabel("密码")).not.toHaveAttribute("placeholder", /Student123/i);
    await expect(page.getByText("内部演示账号")).toHaveCount(0);
    await expect(page.getByText(/student@demo\.com|Student123/)).toHaveCount(0);
    await expectNoCriticalViolations(page, "登录页");

    await page.goto("/register");
    await expectThemeToggleAria(page);
    await expect(page.getByRole("radiogroup", { name: "选择注册身份" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /学生/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByLabel("姓名")).toHaveAttribute("autocomplete", "name");
    await expect(page.getByLabel("邮箱")).toHaveAttribute("type", "email");
    await expect(page.getByLabel("邮箱")).toHaveAttribute("autocomplete", "username");
    await expect(page.getByLabel("密码")).toHaveAttribute("autocomplete", "new-password");
    await page.route("**/api/auth/register", (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: "email exists" })
      })
    );
    await page.getByLabel("姓名").fill("公共入口测试学生");
    await page.getByLabel("邮箱").fill(`${uniqueId("register-a11y")}@local.test`);
    await page.getByLabel("密码").fill(PASSWORD);
    await page.getByRole("button", { name: "注册" }).click();
    await expect(page.locator("#register-form-error")).toHaveAttribute("role", "alert");
    await expect(page.locator("#register-form-error")).toContainText("该邮箱已注册");
    await expectNoCriticalViolations(page, "注册页");

    await page.goto("/recover");
    await expectThemeToggleAria(page);
    await expect(page.getByRole("radiogroup", { name: "选择恢复身份" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /学生/ })).toHaveAttribute("aria-checked", "true");
    await page.route("**/api/auth/recovery-request", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "rate limited" })
      })
    );
    await page.getByRole("textbox", { name: "注册邮箱" }).fill(`${uniqueId("recover-a11y")}@local.test`);
    await page.getByRole("button", { name: "提交恢复请求" }).click();
    await expect(page.locator("#recover-form-error")).toHaveAttribute("role", "alert");
    await expect(page.locator("#recover-form-error")).toContainText("恢复请求提交过于频繁");
    await expectNoCriticalViolations(page, "账号恢复页");
  });

  test("public account recovery keeps selected role context", async ({ page }) => {
    await page.goto("/login?role=teacher&entry=landing");
    await expect(getSelectedRoleRadio(page, "教师")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "忘记教师账号或密码？去恢复" })).toHaveAttribute(
      "href",
      "/recover?role=teacher&entry=login"
    );

    await page.getByRole("link", { name: "忘记教师账号或密码？去恢复" }).click();
    await expect(page).toHaveURL(/\/recover\?role=teacher&entry=login/);
    await expect(getSelectedRoleRadio(page, "教师")).toHaveCount(1);

    await page.route("**/api/auth/recovery-request", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "恢复请求已提交",
          data: {
            ticketId: "REC-TEACHER-1",
            submittedAt: "2026-06-01T08:00:00.000Z",
            serviceLevel: "1 个工作日内处理",
            nextSteps: ["管理员会核验教师身份"]
          }
        })
      })
    );
    await page.getByRole("textbox", { name: "注册邮箱" }).fill(`${uniqueId("teacher-recover")}@local.test`);
    await page.getByRole("button", { name: "提交恢复请求" }).click();
    await expect(page.getByRole("link", { name: "返回教师登录" })).toHaveAttribute(
      "href",
      "/login?role=teacher&entry=recover"
    );
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
