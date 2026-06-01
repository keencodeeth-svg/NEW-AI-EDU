import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PASSWORD = process.env.VISUAL_CHECK_PASSWORD || "Playwright123!";
const FIXED_STUDENT_EMAIL = process.env.VISUAL_CHECK_STUDENT_EMAIL || "";
const FIXED_TEACHER_EMAIL = process.env.VISUAL_CHECK_TEACHER_EMAIL || "";
const STUDENT_NAME = process.env.VISUAL_CHECK_STUDENT_NAME || "Visual Check Student";
const TEACHER_NAME = process.env.VISUAL_CHECK_TEACHER_NAME || "Visual Check Teacher";
const TEACHER_INVITE_CODE = process.env.VISUAL_CHECK_TEACHER_INVITE_CODE || "PW-TEACH-2026";
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
  }
];

const themes = ["light", "dark"];

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
];

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
    }
  } finally {
    await browser.close();
  }

  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));

  const summary = {
    baseUrl,
    screenshotDir,
    reportPath,
    baselinePath: baselinePath || null,
    maxFailures,
    themes,
    totalChecks: results.length,
    failedChecks: unexpectedFailures
  };

  console.log(JSON.stringify({ summary, results }, null, 2));

  if (unexpectedFailures > maxFailures) {
    process.exitCode = 1;
  }

  return { summary, results };
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (invokedFile === currentFile) {
  await runVisualCheck();
}
