import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { isBlockedA11yImpact } from "./a11y-policy";

const PASSWORD = "Playwright123!";
const ADMIN_INVITE_CODE = "PW-ADMIN-2026";
const SCHOOL_ADMIN_INVITE_CODE = "PW-SCHOOL-2026";
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

async function registerParent(page: Page, params: { email: string; name: string; observerCode: string }) {
  const result = await postJson(page, "/api/auth/register", {
    role: "parent",
    email: params.email,
    password: PASSWORD,
    name: params.name,
    observerCode: params.observerCode
  });
  expect(result.ok, `parent registration failed: ${result.status}`).toBe(true);
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

async function loginByApi(
  page: Page,
  params: { email: string; role: "student" | "parent" | "teacher" | "admin" | "school_admin" }
) {
  const result = await postJson(page, "/api/auth/login", {
    email: params.email,
    password: PASSWORD,
    role: params.role
  });
  expect(result.ok, `${params.role} login failed: ${result.status}`).toBe(true);
}

async function getObserverCode(page: Page) {
  const result = await page.evaluate(async () => {
    const response = await fetch("/api/student/profile", {
      headers: {
        "x-test-origin": window.location.origin
      }
    });
    const payload = await response.json().catch(() => null);
    return {
      ok: response.ok,
      status: response.status,
      body: payload
    };
  });
  expect(result.ok, `student profile fetch failed: ${result.status}`).toBe(true);
  const observerCode = result.body?.data?.observerCode;
  expect(observerCode, "observer code should exist after student profile bootstrap").toBeTruthy();
  return observerCode as string;
}

async function registerAdminByApi(page: Page, params: { email: string; name: string }) {
  const result = await postJson(page, "/api/auth/admin-register", {
    email: params.email,
    password: PASSWORD,
    name: params.name,
    inviteCode: ADMIN_INVITE_CODE
  });
  expect(result.ok, `admin registration failed: ${result.status}`).toBe(true);
}

async function registerSchoolAdminByApi(
  page: Page,
  params: { email: string; name: string; schoolName: string; schoolCode: string }
) {
  const result = await postJson(page, "/api/auth/school-register", {
    email: params.email,
    password: PASSWORD,
    name: params.name,
    schoolName: params.schoolName,
    schoolCode: params.schoolCode,
    inviteCode: SCHOOL_ADMIN_INVITE_CODE
  });
  expect(result.ok, `school admin registration failed: ${result.status}`).toBe(true);
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
    await expect(page.getByText("学生、教师、家长与学校都从这里进入各自主线")).toBeVisible();
    const roleEntryGroup = page.getByLabel("学生、教师、家长和学校快速入口");
    await expect(roleEntryGroup.getByRole("link", { name: /学生登录/ })).toHaveAttribute(
      "href",
      "/login?role=student&entry=landing"
    );
    await expect(roleEntryGroup.getByRole("link", { name: /教师登录/ })).toHaveAttribute(
      "href",
      "/login?role=teacher&entry=landing"
    );
    await expect(roleEntryGroup.getByRole("link", { name: /家长登录/ })).toHaveAttribute(
      "href",
      "/login?role=parent&entry=landing"
    );
    await expect(roleEntryGroup.getByRole("link", { name: /学校登录/ })).toHaveAttribute(
      "href",
      "/login?role=school_admin&entry=landing"
    );
    await expect(page.getByText("不需要先按学生路径理解平台，再切换到教师、家长或学校角色。")).toBeVisible();
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
    await expect(page.getByText("学生与家长可自助注册", { exact: true })).toBeVisible();
    await expect(
      page.getByText("教师、学校管理员与平台管理员账号需通过邀请码、学校授权或平台授权开通", { exact: true })
    ).toBeVisible();
    const activationPaths = page.getByLabel("其他角色开通路径");
    await expect(activationPaths.getByRole("link", { name: "教师账号开通" })).toHaveAttribute(
      "href",
      "/teacher/register?entry=register"
    );
    await expect(activationPaths.getByRole("link", { name: "学校账号开通" })).toHaveAttribute(
      "href",
      "/school/register?entry=register"
    );
    await expect(activationPaths.getByRole("link", { name: "平台管理账号开通" })).toHaveAttribute(
      "href",
      "/admin/register?entry=register"
    );
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

  test("recover page exposes form semantics and success status for screen readers", async ({ page }) => {
    await page.goto("/recover?role=teacher&entry=login");
    await expect(page.getByRole("radiogroup", { name: "选择恢复身份" })).toBeVisible();
    await expect(getSelectedRoleRadio(page, "教师")).toHaveCount(1);
    await expect(page.getByRole("combobox", { name: "问题类型" })).toHaveAttribute("required", "");
    await expect(page.getByRole("textbox", { name: "注册邮箱" })).toHaveAttribute("autocomplete", "username");
    await expect(page.getByRole("textbox", { name: "姓名（建议填写）" })).toHaveAttribute("autocomplete", "name");

    await page.route("**/api/auth/recovery-request", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "恢复请求已提交",
          data: {
            ticketId: "REC-A11Y-1",
            submittedAt: "2026-06-01T08:00:00.000Z",
            serviceLevel: "1 个工作日内处理",
            nextSteps: ["管理员会核验教师身份"]
          }
        })
      })
    );
    await page.getByRole("textbox", { name: "注册邮箱" }).fill(`${uniqueId("recover-status")}@local.test`);
    await page.getByRole("button", { name: "提交恢复请求" }).click();
    await expect(page.getByRole("status")).toContainText("恢复请求已提交");
    await expect(page.getByRole("link", { name: "返回教师登录" })).toHaveAttribute(
      "href",
      "/login?role=teacher&entry=recover"
    );
  });

  test("public account recovery keeps selected role context", async ({ page }) => {
    await page.goto("/login?role=teacher&entry=landing");
    await expect(getSelectedRoleRadio(page, "教师")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "忘记教师账号或密码？去恢复" })).toHaveAttribute(
      "href",
      "/recover?role=teacher&entry=login"
    );
    await expect(page.getByRole("link", { name: "教师账号开通方式" })).toHaveAttribute(
      "href",
      "/teacher/register?entry=login&role=teacher"
    );
    await expect(page.getByText("教师账号需要学校邀请码或平台授权后开通")).toBeVisible();

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
    await expect(page.getByRole("status")).toContainText("恢复请求已提交");
    await expect(page.getByRole("link", { name: "返回教师登录" })).toHaveAttribute(
      "href",
      "/login?role=teacher&entry=recover"
    );
    await expect(page.getByRole("link", { name: "返回教师登录" })).toBeVisible();
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

  test("ai classroom and student experience classroom have no critical accessibility violations", async ({ page }) => {
    await page.goto("/ai-classroom");
    await expect(page.getByTestId("ai-classroom-headline")).toBeVisible({ timeout: 15_000 });
    await expectThemeToggleAria(page);
    await expect(page.locator(".main")).toHaveAttribute("id", "main-content");
    await expectNoCriticalViolations(page, "AI 课堂工作区");

    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "service temporarily unavailable" })
      })
    );
    await page.goto("/student/interactive-classroom?mode=interest-cultivation");
    await expect(page.getByRole("heading", { name: "知序课堂" })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByText("体验模式").first()).toBeVisible();
    await expect(page.getByText("真实画像、今日任务和课表暂未接入")).toBeVisible();
    await expectThemeToggleAria(page);
    await expectNoCriticalViolations(page, "学生体验模式互动课堂");
  });

  test("admin and school governance pages have no critical accessibility violations", async ({ page }) => {
    const adminEmail = `${uniqueId("a11y-admin")}@local.test`;
    const schoolCode = `A11Y${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
    const schoolAdminEmail = `${uniqueId("a11y-school")}@local.test`;

    await page.goto("/login?role=admin");
    await registerAdminByApi(page, {
      email: adminEmail,
      name: "A11y Admin"
    });
    await loginByApi(page, {
      email: adminEmail,
      role: "admin"
    });
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "管理运营工作台" })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByRole("list", { name: "管理员今日优先行动" })).toBeVisible();
    await expectThemeToggleAria(page);
    await expect(page.locator(".app-sidebar")).toBeVisible();
    await expectNoCriticalViolations(page, "管理运营工作台");

    await page.goto("/school/register");
    await registerSchoolAdminByApi(page, {
      email: schoolAdminEmail,
      name: "A11y School Admin",
      schoolName: `A11y School ${schoolCode}`,
      schoolCode
    });
    await loginByApi(page, {
      email: schoolAdminEmail,
      role: "school_admin"
    });
    await page.goto("/school");
    await expect(page.getByRole("heading", { name: "学校质量与课堂应用" })).toBeVisible({
      timeout: 15_000
    });
    await expectThemeToggleAria(page);
    await expect(page.locator(".app-sidebar")).toBeVisible();
    await expectNoCriticalViolations(page, "学校质量工作台");

    await page.goto("/school/interactive-classrooms");
    await expect(page.getByRole("heading", { name: "课堂质量中心" })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.locator(".main")).toHaveAttribute("id", "main-content");
    await expectNoCriticalViolations(page, "学校互动课堂质量中心");
  });

  test("route inventory accessibility: parent dashboard has no critical accessibility violations", async ({ page }) => {
    const studentEmail = `${uniqueId("a11y-parent-student")}@local.test`;
    const parentEmail = `${uniqueId("a11y-parent")}@local.test`;

    await page.goto("/register?role=student");
    await registerStudent(page, {
      email: studentEmail,
      name: "A11y Parent Student"
    });
    await loginByApi(page, {
      email: studentEmail,
      role: "student"
    });
    const observerCode = await getObserverCode(page);

    await page.goto("/register?role=parent");
    await registerParent(page, {
      email: parentEmail,
      name: "A11y Parent",
      observerCode
    });
    await loginByApi(page, {
      email: parentEmail,
      role: "parent"
    });

    await page.goto("/parent");
    await dismissGuidedTourIfVisible(page);
    await expect(page.getByRole("heading", { name: "家长空间" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "刷新" })).toBeVisible();
    await expect(page.locator(".app-sidebar")).toBeVisible();
    await expect(page.locator(".main")).toHaveAttribute("id", "main-content");
    await expectThemeToggleAria(page);
    await expectNoCriticalViolations(page, "家长空间");
  });

  test("route inventory accessibility: library page has no critical accessibility violations", async ({ page }) => {
    const adminEmail = `${uniqueId("a11y-library-admin")}@local.test`;

    await page.goto("/admin/register");
    await registerAdminByApi(page, {
      email: adminEmail,
      name: "A11y Library Admin"
    });
    await loginByApi(page, {
      email: adminEmail,
      role: "admin"
    });

    await page.goto("/library");
    await expect(page.getByRole("heading", { name: "教材与课件资料库" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "导入资料" })).toBeVisible();
    await expect(page.locator(".app-sidebar")).toBeVisible();
    await expect(page.locator(".main")).toHaveAttribute("id", "main-content");
    await expectThemeToggleAria(page);
    await expectNoCriticalViolations(page, "教材与课件资料库");
  });

  test("route inventory accessibility: teacher lesson planner has no critical accessibility violations", async ({
    page
  }) => {
    const teacherEmail = `${uniqueId("a11y-lesson-teacher")}@local.test`;

    await page.goto("/login?role=teacher");
    await registerTeacherByApi(page, {
      email: teacherEmail,
      name: "A11y Lesson Teacher"
    });
    await loginByApi(page, {
      email: teacherEmail,
      role: "teacher"
    });

    await page.goto("/teacher/lesson-planner");
    await expect(page.getByRole("heading", { name: "AI 备课助手" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("主题")).toBeVisible();
    await expect(page.getByRole("button", { name: "生成备课方案" })).toBeDisabled();
    await expect(page.locator(".app-sidebar")).toBeVisible();
    await expect(page.locator(".main")).toHaveAttribute("id", "main-content");
    await expectThemeToggleAria(page);
    await expectNoCriticalViolations(page, "AI 备课助手");
  });
});
