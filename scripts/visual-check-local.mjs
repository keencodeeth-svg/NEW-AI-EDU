import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PASSWORD = process.env.VISUAL_CHECK_PASSWORD || "Playwright123!";
const FIXED_STUDENT_EMAIL = process.env.VISUAL_CHECK_STUDENT_EMAIL || "";
const FIXED_TEACHER_EMAIL = process.env.VISUAL_CHECK_TEACHER_EMAIL || "";
const FIXED_PARENT_EMAIL = process.env.VISUAL_CHECK_PARENT_EMAIL || "";
const FIXED_SCHOOL_ADMIN_EMAIL = process.env.VISUAL_CHECK_SCHOOL_ADMIN_EMAIL || "";
const FIXED_ADMIN_EMAIL = process.env.VISUAL_CHECK_ADMIN_EMAIL || "";
const STUDENT_NAME = process.env.VISUAL_CHECK_STUDENT_NAME || "Visual Check Student";
const TEACHER_NAME = process.env.VISUAL_CHECK_TEACHER_NAME || "Visual Check Teacher";
const PARENT_NAME = process.env.VISUAL_CHECK_PARENT_NAME || "Visual Check Parent";
const SCHOOL_ADMIN_NAME = process.env.VISUAL_CHECK_SCHOOL_ADMIN_NAME || "Visual Check School Admin";
const ADMIN_NAME = process.env.VISUAL_CHECK_ADMIN_NAME || "Visual Check Admin";
const TEACHER_INVITE_CODE = process.env.VISUAL_CHECK_TEACHER_INVITE_CODE || "PW-TEACH-2026";
const SCHOOL_ADMIN_INVITE_CODE = process.env.VISUAL_CHECK_SCHOOL_ADMIN_INVITE_CODE || "PW-SCHOOL-2026";
const ADMIN_INVITE_CODE = process.env.VISUAL_CHECK_ADMIN_INVITE_CODE || "PW-ADMIN-2026";
const baseUrl = process.env.VISUAL_CHECK_BASE_URL || "http://127.0.0.1:3001";
const screenshotDir = process.env.VISUAL_CHECK_SCREENSHOT_DIR || "output/playwright";
const reportPath = process.env.VISUAL_CHECK_REPORT_PATH || path.join(screenshotDir, "visual-check.json");
const baselinePath = process.env.VISUAL_CHECK_BASELINE_PATH || "";
const maxFailures = readNumberEnv("VISUAL_CHECK_MAX_FAILURES", 0);
const waitAfterThemeToggleMs = readNumberEnv("VISUAL_CHECK_THEME_WAIT_MS", 200);

const publicRoutes = [
  {
    route: "/",
    slug: "home",
    expectedShell: "public",
    requiredSelectors: [".public-header-links", ".theme-mode-toggle", ".skip-link"],
    forbiddenSelectors: [".app-sidebar"]
  },
  {
    route: "/login",
    slug: "login",
    expectedShell: "public",
    requiredSelectors: [".public-header-links", ".theme-mode-toggle", ".skip-link"],
    forbiddenSelectors: [".app-sidebar"]
  },
  {
    route: "/register",
    slug: "register",
    expectedShell: "public",
    requiredSelectors: [".public-header-links", ".theme-mode-toggle", ".skip-link"],
    forbiddenSelectors: [".app-sidebar"]
  },
  {
    route: "/recover",
    slug: "recover",
    expectedShell: "public",
    requiredSelectors: [".public-header-links", ".theme-mode-toggle", ".skip-link"],
    forbiddenSelectors: [".app-sidebar"]
  },
  {
    route: "/ai-classroom",
    slug: "ai-classroom",
    expectedShell: "public",
    headingText: "先讲清给谁上、学什么、学完去哪，让教材、班级与数字人老师进入同一课堂主线",
    requiredSelectors: [".public-header-links", ".theme-mode-toggle", ".skip-link", ".main", "[data-testid='ai-classroom-headline']"],
    forbiddenSelectors: [".app-sidebar"]
  }
];

const studentRoutes = [
  {
    route: "/student",
    slug: "student-dashboard",
    expectedShell: "authenticated",
    headingText: "今天直接开始",
    requireSidebarOnDesktop: true,
    requireMobileTabbarOnMobile: true,
    requiredSelectors: [".theme-mode-toggle", ".skip-link", ".main"],
    forbiddenSelectors: [".public-header-links"]
  },
  {
    route: "/practice",
    slug: "practice",
    expectedShell: "authenticated",
    headingText: "智能练习",
    requireSidebarOnDesktop: true,
    requireMobileTabbarOnMobile: true,
    requiredSelectors: [".theme-mode-toggle", ".skip-link", ".main"],
    forbiddenSelectors: [".public-header-links"]
  },
  {
    route: "/student/interactive-classroom",
    slug: "student-interactive-classroom",
    expectedShell: "authenticated",
    headingText: "航科互动课堂",
    requireSidebarOnDesktop: true,
    requireMobileTabbarOnMobile: true,
    requiredSelectors: [".theme-mode-toggle", ".skip-link", ".main"],
    forbiddenSelectors: [".public-header-links"]
  },
  {
    route: "/student/exams",
    slug: "student-exams",
    expectedShell: "authenticated",
    headingText: "在线考试",
    requireSidebarOnDesktop: true,
    requireMobileTabbarOnMobile: true,
    requiredSelectors: [".theme-mode-toggle", ".skip-link", ".main"],
    forbiddenSelectors: [".public-header-links"]
  }
];

const teacherRoutes = [
  {
    route: "/teacher",
    slug: "teacher-dashboard",
    expectedShell: "authenticated",
    headingText: "现在先开工",
    requireSidebarOnDesktop: true,
    requireMobileTabbarOnMobile: true,
    requiredSelectors: [".theme-mode-toggle", ".skip-link", ".main"],
    forbiddenSelectors: [".public-header-links"]
  },
  {
    route: "/teacher/classroom-live",
    slug: "teacher-classroom-live",
    expectedShell: "authenticated",
    headingText: "课堂实时仪表盘",
    requireSidebarOnDesktop: true,
    requireMobileTabbarOnMobile: true,
    requiredSelectors: [".theme-mode-toggle", ".skip-link", ".main"],
    forbiddenSelectors: [".public-header-links"]
  },
  {
    route: "/teacher/lesson-planner",
    slug: "teacher-lesson-planner",
    expectedShell: "authenticated",
    headingText: "AI 备课助手",
    requireSidebarOnDesktop: true,
    requireMobileTabbarOnMobile: true,
    requiredSelectors: [".theme-mode-toggle", ".skip-link", ".main"],
    forbiddenSelectors: [".public-header-links"]
  }
];

const parentRoutes = [
  {
    route: "/parent",
    slug: "parent-dashboard",
    expectedShell: "authenticated",
    headingText: "家长空间",
    requireSidebarOnDesktop: true,
    requireMobileTabbarOnMobile: true,
    requiredSelectors: [".theme-mode-toggle", ".skip-link", ".main"],
    forbiddenSelectors: [".public-header-links"]
  }
];

const schoolRoutes = [
  {
    route: "/school",
    slug: "school-dashboard",
    expectedShell: "authenticated",
    headingText: "学校质量与课堂应用",
    requireSidebarOnDesktop: true,
    requireMobileTabbarOnMobile: true,
    requiredSelectors: [".theme-mode-toggle", ".skip-link", ".main"],
    forbiddenSelectors: [".public-header-links"]
  },
  {
    route: "/school/interactive-classrooms",
    slug: "school-interactive-classrooms",
    expectedShell: "authenticated",
    headingText: "课堂质量中心",
    requireSidebarOnDesktop: true,
    requireMobileTabbarOnMobile: true,
    requiredSelectors: [".theme-mode-toggle", ".skip-link", ".main"],
    forbiddenSelectors: [".public-header-links"]
  }
];

const adminRoutes = [
  {
    route: "/admin",
    slug: "admin-dashboard",
    expectedShell: "authenticated",
    headingText: "管理运营工作台",
    requireSidebarOnDesktop: true,
    requireMobileTabbarOnMobile: true,
    requiredSelectors: [".theme-mode-toggle", ".skip-link", ".main"],
    forbiddenSelectors: [".public-header-links"]
  }
];

const themes = ["light", "dark"];

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
];

function getVisualSessionRouteMap() {
  return {
    public: publicRoutes,
    student: studentRoutes,
    parent: parentRoutes,
    teacher: teacherRoutes,
    school: schoolRoutes,
    admin: adminRoutes
  };
}

function getVisualRouteGroups() {
  const sessionRouteMap = getVisualSessionRouteMap();
  return Object.fromEntries(
    Object.entries(sessionRouteMap).map(([session, routes]) => [session, routes.map((route) => route.route)])
  );
}

function readNumberEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasVisibleNode(snapshot) {
  return snapshot.exists && snapshot.display !== "none" && snapshot.visibility !== "hidden" && snapshot.opacity !== "0";
}

function createRuleResult(name, passed, details) {
  return { name, passed, details };
}

function getThemeButtonName(theme) {
  if (theme === "dark") {
    return "切换到暗色模式";
  }
  if (theme === "light") {
    return "切换到浅色模式";
  }
  return "跟随系统外观";
}

function sanitizeSlug(route) {
  return route === "/" ? "home" : route.slice(1).replaceAll("/", "-");
}

export function getVisualRouteMatrix() {
  const routeGroups = getVisualRouteGroups();
  return {
    publicRoutes: routeGroups.public,
    studentRoutes: routeGroups.student,
    parentRoutes: routeGroups.parent,
    teacherRoutes: routeGroups.teacher,
    schoolRoutes: routeGroups.school,
    adminRoutes: routeGroups.admin
  };
}

export function getVisualSessionGroups() {
  return getVisualRouteGroups();
}

export function getVisualCoverageSummary() {
  const sessionGroups = getVisualSessionGroups();
  const routeCountsBySession = Object.fromEntries(
    Object.entries(sessionGroups).map(([session, routes]) => [session, routes.length])
  );
  const totalRoutes = Object.values(routeCountsBySession).reduce((sum, count) => sum + count, 0);
  const viewportNames = viewports.map((viewport) => viewport.name);

  return {
    totalRoutes,
    routeCountsBySession,
    viewportNames,
    themes: [...themes],
    totalChecks: totalRoutes * viewportNames.length * themes.length
  };
}

export function getResultKey(route, viewport, theme) {
  return `${route}::${viewport}::${theme}`;
}

function getLegacyBaselineKey(route, viewport) {
  return `${route}::${viewport}`;
}

export function getScreenshotFileName(slug, viewport, theme) {
  return `${slug}-${viewport}-${theme}.png`;
}

function normalizeBaseline(rawBaseline) {
  const baselineMap = new Map();
  if (!Array.isArray(rawBaseline)) {
    return baselineMap;
  }

  for (const item of rawBaseline) {
    if (!item || typeof item.route !== "string" || typeof item.viewport !== "string") {
      continue;
    }

    if (typeof item.theme === "string") {
      baselineMap.set(getResultKey(item.route, item.viewport, item.theme), item);
      continue;
    }

    baselineMap.set(getLegacyBaselineKey(item.route, item.viewport), item);
  }

  return baselineMap;
}

async function loadBaseline() {
  if (!baselinePath) {
    return new Map();
  }

  try {
    const content = await fs.readFile(baselinePath, "utf8");
    return normalizeBaseline(JSON.parse(content));
  } catch (error) {
    throw new Error(`Failed to load baseline from ${baselinePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function getBaselineForResult(baselineMap, route, viewport, theme) {
  return baselineMap.get(getResultKey(route, viewport, theme)) ?? baselineMap.get(getLegacyBaselineKey(route, viewport)) ?? null;
}

function uniqueEmail(prefix, fixedEmail) {
  if (fixedEmail) {
    return fixedEmail;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@local.test`;
}

async function evaluateJson(page, requestUrl, requestBody) {
  return page.evaluate(
    async ({ targetUrl, body }) => {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-origin": window.location.origin
        },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => null);
      return { ok: response.ok, status: response.status, body: payload };
    },
    { targetUrl: requestUrl, body: requestBody }
  );
}

async function ensureStudentSession(page) {
  const email = uniqueEmail("visual-check-student", FIXED_STUDENT_EMAIL);

  await page.goto(`${baseUrl}/login?role=student`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  const registration = await evaluateJson(page, "/api/auth/register", {
    role: "student",
    email,
    password: PASSWORD,
    name: STUDENT_NAME,
    grade: "4"
  });

  if (!registration.ok && FIXED_STUDENT_EMAIL && registration.status >= 400 && registration.status < 500) {
    console.warn(`Student registration skipped for ${email}: ${registration.status}`);
  } else if (!registration.ok) {
    throw new Error(`Student registration failed: ${registration.status} ${JSON.stringify(registration.body)}`);
  }

  const login = await evaluateJson(page, "/api/auth/login", {
    email,
    password: PASSWORD,
    role: "student"
  });

  if (!login.ok) {
    throw new Error(`Student login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }

  return { email };
}

async function ensureTeacherSession(page) {
  const email = uniqueEmail("visual-check-teacher", FIXED_TEACHER_EMAIL);

  await page.goto(`${baseUrl}/login?role=teacher`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  const registration = await evaluateJson(page, "/api/auth/teacher-register", {
    email,
    password: PASSWORD,
    name: TEACHER_NAME,
    inviteCode: TEACHER_INVITE_CODE
  });

  if (!registration.ok && FIXED_TEACHER_EMAIL && registration.status >= 400 && registration.status < 500) {
    console.warn(`Teacher registration skipped for ${email}: ${registration.status}`);
  } else if (!registration.ok) {
    throw new Error(`Teacher registration failed: ${registration.status} ${JSON.stringify(registration.body)}`);
  }

  const login = await evaluateJson(page, "/api/auth/login", {
    email,
    password: PASSWORD,
    role: "teacher"
  });

  if (!login.ok) {
    throw new Error(`Teacher login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }

  return { email };
}

async function getObserverCode(page) {
  const profile = await page.evaluate(async () => {
    const response = await fetch("/api/student/profile", {
      cache: "no-store",
      headers: {
        "x-test-origin": window.location.origin
      }
    });
    const payload = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, body: payload };
  });

  if (!profile.ok) {
    throw new Error(`Student profile fetch failed: ${profile.status} ${JSON.stringify(profile.body)}`);
  }

  const observerCode = profile.body?.data?.observerCode;
  if (!observerCode) {
    throw new Error(`Student observer code missing: ${JSON.stringify(profile.body)}`);
  }

  return observerCode;
}

async function ensureParentSession(page) {
  const email = uniqueEmail("visual-check-parent", FIXED_PARENT_EMAIL);
  const studentSession = await ensureStudentSession(page);
  const observerCode = await getObserverCode(page);

  const registration = await evaluateJson(page, "/api/auth/register", {
    role: "parent",
    email,
    password: PASSWORD,
    name: PARENT_NAME,
    observerCode
  });

  if (!registration.ok && FIXED_PARENT_EMAIL && registration.status >= 400 && registration.status < 500) {
    console.warn(`Parent registration skipped for ${email}: ${registration.status}`);
  } else if (!registration.ok) {
    throw new Error(`Parent registration failed: ${registration.status} ${JSON.stringify(registration.body)}`);
  }

  const teacherEmail = uniqueEmail("visual-check-parent-teacher", "");
  await page.goto(`${baseUrl}/login?role=teacher`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  const teacherRegistration = await evaluateJson(page, "/api/auth/teacher-register", {
    email: teacherEmail,
    password: PASSWORD,
    name: TEACHER_NAME,
    inviteCode: TEACHER_INVITE_CODE
  });

  if (!teacherRegistration.ok) {
    throw new Error(
      `Parent fixture teacher registration failed: ${teacherRegistration.status} ${JSON.stringify(teacherRegistration.body)}`
    );
  }

  const teacherLogin = await evaluateJson(page, "/api/auth/login", {
    email: teacherEmail,
    password: PASSWORD,
    role: "teacher"
  });

  if (!teacherLogin.ok) {
    throw new Error(`Parent fixture teacher login failed: ${teacherLogin.status} ${JSON.stringify(teacherLogin.body)}`);
  }

  const classResult = await evaluateJson(page, "/api/teacher/classes", {
    name: `Visual Check Parent Class ${Date.now().toString(36)}`,
    subject: "math",
    grade: "4"
  });

  if (!classResult.ok) {
    throw new Error(`Parent fixture class creation failed: ${classResult.status} ${JSON.stringify(classResult.body)}`);
  }

  const classId = classResult.body?.data?.id;
  if (!classId) {
    throw new Error(`Parent fixture class id missing: ${JSON.stringify(classResult.body)}`);
  }

  const enrollResult = await evaluateJson(page, `/api/teacher/classes/${classId}/students`, {
    email: studentSession.email
  });

  if (!enrollResult.ok) {
    throw new Error(`Parent fixture add student failed: ${enrollResult.status} ${JSON.stringify(enrollResult.body)}`);
  }

  const assignmentResult = await evaluateJson(page, "/api/teacher/assignments", {
    classId,
    title: `Visual Check Parent Assignment ${Date.now().toString(36)}`,
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    submissionType: "essay",
    maxUploads: 1,
    gradingFocus: "先确认是否按时完成，再看表达与步骤是否完整。"
  });

  if (!assignmentResult.ok) {
    throw new Error(
      `Parent fixture assignment creation failed: ${assignmentResult.status} ${JSON.stringify(assignmentResult.body)}`
    );
  }

  const parentLogin = await evaluateJson(page, "/api/auth/login", {
    email,
    password: PASSWORD,
    role: "parent"
  });

  if (!parentLogin.ok) {
    throw new Error(`Parent login failed: ${parentLogin.status} ${JSON.stringify(parentLogin.body)}`);
  }

  return { email };
}

async function ensureSchoolSession(page) {
  const email = uniqueEmail("visual-check-school-admin", FIXED_SCHOOL_ADMIN_EMAIL);
  const schoolCode = `VCSCH${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

  await page.goto(`${baseUrl}/school/register`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  const registration = await evaluateJson(page, "/api/auth/school-register", {
    email,
    password: PASSWORD,
    name: SCHOOL_ADMIN_NAME,
    schoolName: `Visual Check School ${schoolCode}`,
    schoolCode,
    inviteCode: SCHOOL_ADMIN_INVITE_CODE
  });

  if (!registration.ok && FIXED_SCHOOL_ADMIN_EMAIL && registration.status >= 400 && registration.status < 500) {
    console.warn(`School admin registration skipped for ${email}: ${registration.status}`);
  } else if (!registration.ok) {
    throw new Error(`School admin registration failed: ${registration.status} ${JSON.stringify(registration.body)}`);
  }

  const login = await evaluateJson(page, "/api/auth/login", {
    email,
    password: PASSWORD,
    role: "school_admin"
  });

  if (!login.ok) {
    throw new Error(`School admin login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }

  return { email };
}

async function ensureAdminSession(page) {
  const email = uniqueEmail("visual-check-admin", FIXED_ADMIN_EMAIL);

  await page.goto(`${baseUrl}/admin/register`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  const registration = await evaluateJson(page, "/api/auth/admin-register", {
    email,
    password: PASSWORD,
    name: ADMIN_NAME,
    inviteCode: ADMIN_INVITE_CODE
  });

  if (!registration.ok && FIXED_ADMIN_EMAIL && registration.status >= 400 && registration.status < 500) {
    console.warn(`Admin registration skipped for ${email}: ${registration.status}`);
  } else if (!registration.ok) {
    throw new Error(`Admin registration failed: ${registration.status} ${JSON.stringify(registration.body)}`);
  }

  const login = await evaluateJson(page, "/api/auth/login", {
    email,
    password: PASSWORD,
    role: "admin"
  });

  if (!login.ok) {
    throw new Error(`Admin login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }

  return { email };
}

async function dismissGuidedTourIfVisible(page) {
  const skipButton = page.getByRole("button", { name: "跳过" });
  if (await skipButton.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await skipButton.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined);
  }
}

async function setTheme(page, theme) {
  const toggle = page.locator(".theme-mode-toggle");
  if (!(await toggle.count())) {
    return {
      themeTogglePresent: false,
      targetTheme: theme,
      rootClass: (await page.locator("html").getAttribute("class")) ?? "",
      themeApplied: false
    };
  }

  const button = page.getByRole("button", { name: getThemeButtonName(theme) });
  await button.click();
  await page.waitForTimeout(waitAfterThemeToggleMs);

  const rootClass = (await page.locator("html").getAttribute("class")) ?? "";
  const isDark = rootClass.includes("dark");

  return {
    themeTogglePresent: true,
    targetTheme: theme,
    rootClass,
    themeApplied: theme === "dark" ? isDark : !isDark
  };
}

async function collectPageMetrics(page, routeConfig, viewportName, themeState) {
  const shellMetrics = await page.evaluate(
    ({ selectors, viewport }) => {
      const html = document.documentElement;
      const getSnapshot = (selector) => {
        const node = document.querySelector(selector);
        if (!node) {
          return {
            exists: false,
            display: null,
            visibility: null,
            opacity: null
          };
        }
        const style = window.getComputedStyle(node);
        return {
          exists: true,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity
        };
      };

      const snapshots = Object.fromEntries(selectors.map((selector) => [selector, getSnapshot(selector)]));
      return {
        title: document.title,
        pathname: window.location.pathname,
        viewport,
        scrollWidth: html.scrollWidth,
        clientWidth: html.clientWidth,
        bodyScrollWidth: document.body?.scrollWidth ?? 0,
        overflowX: html.scrollWidth > html.clientWidth + 1,
        snapshots
      };
    },
    {
      selectors: [
        ".app-sidebar",
        ".mobile-tabbar",
        ".theme-mode-toggle",
        ".public-header-links",
        ".skip-link",
        ".main",
        ...routeConfig.requiredSelectors,
        ...routeConfig.forbiddenSelectors
      ],
      viewport: viewportName
    }
  );

  const rules = [];
  rules.push(
    createRuleResult(
      "http-status-ok",
      true,
      "validated separately from page metrics collection"
    )
  );
  rules.push(
    createRuleResult(
      "theme-toggle-present",
      themeState.themeTogglePresent,
      themeState.themeTogglePresent ? "theme toggle located" : "missing .theme-mode-toggle"
    )
  );
  rules.push(
    createRuleResult(
      "theme-applied",
      themeState.themeApplied,
      `target=${themeState.targetTheme} rootClass=${themeState.rootClass || "(empty)"}`
    )
  );
  rules.push(
    createRuleResult(
      "no-horizontal-overflow",
      !shellMetrics.overflowX,
      `scrollWidth=${shellMetrics.scrollWidth}, clientWidth=${shellMetrics.clientWidth}, bodyScrollWidth=${shellMetrics.bodyScrollWidth}`
    )
  );

  for (const selector of routeConfig.requiredSelectors) {
    const snapshot = shellMetrics.snapshots[selector];
    rules.push(
      createRuleResult(
        `required:${selector}`,
        hasVisibleNode(snapshot),
        JSON.stringify(snapshot)
      )
    );
  }

  for (const selector of routeConfig.forbiddenSelectors) {
    const snapshot = shellMetrics.snapshots[selector];
    rules.push(
      createRuleResult(
        `forbidden:${selector}`,
        !hasVisibleNode(snapshot),
        JSON.stringify(snapshot)
      )
    );
  }

  const sidebarSnapshot = shellMetrics.snapshots[".app-sidebar"];
  const mobileTabbarSnapshot = shellMetrics.snapshots[".mobile-tabbar"];

  if (routeConfig.requireSidebarOnDesktop && viewportName === "desktop") {
    rules.push(
      createRuleResult("desktop-sidebar-visible", hasVisibleNode(sidebarSnapshot), JSON.stringify(sidebarSnapshot))
    );
  }

  if (routeConfig.requireMobileTabbarOnMobile && viewportName === "mobile") {
    rules.push(
      createRuleResult("mobile-tabbar-visible", hasVisibleNode(mobileTabbarSnapshot), JSON.stringify(mobileTabbarSnapshot))
    );
  }

  if (routeConfig.expectedShell === "public" && viewportName === "mobile") {
    rules.push(
      createRuleResult("public-mobile-tabbar-hidden", !hasVisibleNode(mobileTabbarSnapshot), JSON.stringify(mobileTabbarSnapshot))
    );
  }

  if (routeConfig.headingText) {
    const headingVisible = await page.getByRole("heading", { name: routeConfig.headingText }).isVisible().catch(() => false);
    rules.push(
      createRuleResult("route-heading-visible", headingVisible, routeConfig.headingText)
    );
  }

  return {
    ...shellMetrics,
    theme: themeState.targetTheme,
    themeRootClass: themeState.rootClass,
    themeTogglePresent: themeState.themeTogglePresent,
    themeApplied: themeState.themeApplied,
    rules
  };
}

function compareWithBaseline(result, baseline) {
  if (!baseline) {
    return [];
  }

  const comparisons = [];
  const widthDelta = Math.abs((baseline.scrollWidth ?? 0) - result.scrollWidth);
  const bodyWidthDelta = Math.abs((baseline.bodyScrollWidth ?? 0) - result.bodyScrollWidth);
  comparisons.push(
    createRuleResult(
      "baseline-scroll-width-delta",
      widthDelta <= 4,
      `baseline=${baseline.scrollWidth ?? "n/a"} current=${result.scrollWidth} delta=${widthDelta}`
    )
  );
  comparisons.push(
    createRuleResult(
      "baseline-body-scroll-width-delta",
      bodyWidthDelta <= 4,
      `baseline=${baseline.bodyScrollWidth ?? "n/a"} current=${result.bodyScrollWidth} delta=${bodyWidthDelta}`
    )
  );
  if (typeof baseline.overflowX === "boolean") {
    comparisons.push(
      createRuleResult(
        "baseline-overflow-x-match",
        baseline.overflowX === result.overflowX,
        `baseline=${baseline.overflowX} current=${result.overflowX}`
      )
    );
  }
  if (typeof baseline.theme === "string") {
    comparisons.push(
      createRuleResult(
        "baseline-theme-match",
        baseline.theme === result.theme,
        `baseline=${baseline.theme} current=${result.theme}`
      )
    );
  }
  return comparisons;
}

async function runRouteChecks(page, routeConfig, viewportName, baselineMap) {
  const response = await page.goto(`${baseUrl}${routeConfig.route}`, {
    waitUntil: "networkidle",
    timeout: 30_000
  });

  await dismissGuidedTourIfVisible(page);

  const routeResults = [];

  for (const theme of themes) {
    const themeState = await setTheme(page, theme);
    const result = await collectPageMetrics(page, routeConfig, viewportName, themeState);
    result.route = routeConfig.route;
    result.viewport = viewportName;
    result.theme = theme;
    result.slug = routeConfig.slug || sanitizeSlug(routeConfig.route);
    result.key = getResultKey(routeConfig.route, viewportName, theme);
    result.expectedShell = routeConfig.expectedShell;
    result.status = response?.status() ?? 0;
    result.screenshot = path.join(screenshotDir, getScreenshotFileName(result.slug, viewportName, theme));
    result.rules[0] = createRuleResult("http-status-ok", result.status >= 200 && result.status < 400, `status=${result.status}`);
    result.rules.push(...compareWithBaseline(result, getBaselineForResult(baselineMap, routeConfig.route, viewportName, theme)));
    result.failedRules = result.rules.filter((rule) => !rule.passed);
    result.passed = result.failedRules.length === 0;

    await page.screenshot({
      path: result.screenshot,
      fullPage: true
    });

    routeResults.push(result);
  }

  return routeResults;
}

export async function runVisualCheck() {
  await fs.mkdir(screenshotDir, { recursive: true });

  const baselineMap = await loadBaseline();
  const browser = await chromium.launch({ headless: true });
  const results = [];
  let unexpectedFailures = 0;

  try {
    for (const viewport of viewports) {
      const publicContext = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      const publicPage = await publicContext.newPage();

      for (const routeConfig of publicRoutes) {
        const routeResults = await runRouteChecks(publicPage, routeConfig, viewport.name, baselineMap);
        for (const result of routeResults) {
          if (!result.passed) {
            unexpectedFailures += 1;
          }
          results.push(result);
        }
      }

      await publicContext.close();

      const studentContext = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      const studentPage = await studentContext.newPage();
      await ensureStudentSession(studentPage);

      for (const routeConfig of studentRoutes) {
        const routeResults = await runRouteChecks(studentPage, routeConfig, viewport.name, baselineMap);
        for (const result of routeResults) {
          if (!result.passed) {
            unexpectedFailures += 1;
          }
          results.push(result);
        }
      }

      await studentContext.close();

      const teacherContext = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      const teacherPage = await teacherContext.newPage();
      await ensureTeacherSession(teacherPage);

      for (const routeConfig of teacherRoutes) {
        const routeResults = await runRouteChecks(teacherPage, routeConfig, viewport.name, baselineMap);
        for (const result of routeResults) {
          if (!result.passed) {
            unexpectedFailures += 1;
          }
          results.push(result);
        }
      }

      await teacherContext.close();

      const parentContext = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      const parentPage = await parentContext.newPage();
      await ensureParentSession(parentPage);

      for (const routeConfig of parentRoutes) {
        const routeResults = await runRouteChecks(parentPage, routeConfig, viewport.name, baselineMap);
        for (const result of routeResults) {
          if (!result.passed) {
            unexpectedFailures += 1;
          }
          results.push(result);
        }
      }

      await parentContext.close();

      const schoolContext = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      const schoolPage = await schoolContext.newPage();
      await ensureSchoolSession(schoolPage);

      for (const routeConfig of schoolRoutes) {
        const routeResults = await runRouteChecks(schoolPage, routeConfig, viewport.name, baselineMap);
        for (const result of routeResults) {
          if (!result.passed) {
            unexpectedFailures += 1;
          }
          results.push(result);
        }
      }

      await schoolContext.close();

      const adminContext = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      const adminPage = await adminContext.newPage();
      await ensureAdminSession(adminPage);

      for (const routeConfig of adminRoutes) {
        const routeResults = await runRouteChecks(adminPage, routeConfig, viewport.name, baselineMap);
        for (const result of routeResults) {
          if (!result.passed) {
            unexpectedFailures += 1;
          }
          results.push(result);
        }
      }

      await adminContext.close();
    }
  } finally {
    await browser.close();
  }

  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));

  const coverageSummary = getVisualCoverageSummary();
  const summary = {
    baseUrl,
    screenshotDir,
    reportPath,
    baselinePath: baselinePath || null,
    maxFailures,
    themes: coverageSummary.themes,
    viewportNames: coverageSummary.viewportNames,
    routeCountsBySession: coverageSummary.routeCountsBySession,
    totalRoutes: coverageSummary.totalRoutes,
    totalChecks: results.length,
    failedChecks: unexpectedFailures
  };

  console.log(JSON.stringify({ summary, coverageSummary, results }, null, 2));

  if (unexpectedFailures > maxFailures) {
    process.exitCode = 1;
  }

  return { summary, coverageSummary, results };
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (invokedFile === currentFile) {
  await runVisualCheck();
}
