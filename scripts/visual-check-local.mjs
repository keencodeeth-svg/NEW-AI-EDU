import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const PASSWORD = process.env.VISUAL_CHECK_PASSWORD || "Playwright123!";
const FIXED_STUDENT_EMAIL = process.env.VISUAL_CHECK_STUDENT_EMAIL || "";
const STUDENT_NAME = process.env.VISUAL_CHECK_STUDENT_NAME || "Visual Check Student";
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
    requiredSelectors: [".public-header-links", ".theme-mode-toggle"],
    forbiddenSelectors: [".app-sidebar"]
  },
  {
    route: "/ai-classroom",
    slug: "ai-classroom",
    expectedShell: "public",
    requiredSelectors: [".public-header-links", ".theme-mode-toggle"],
    forbiddenSelectors: [".app-sidebar"]
  }
];

const authenticatedRoutes = [
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
    route: "/student/interactive-classroom",
    slug: "student-interactive-classroom",
    expectedShell: "authenticated",
    requireSidebarOnDesktop: true,
    requireMobileTabbarOnMobile: true,
    requiredSelectors: [".theme-mode-toggle", ".main"],
    forbiddenSelectors: [".public-header-links"]
  }
];

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

function normalizeBaseline(rawBaseline) {
  const baselineMap = new Map();
  if (!Array.isArray(rawBaseline)) {
    return baselineMap;
  }

  for (const item of rawBaseline) {
    if (!item || typeof item.route !== "string" || typeof item.viewport !== "string") {
      continue;
    }
    baselineMap.set(`${item.route}::${item.viewport}`, item);
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

async function ensureStudentSession(page) {
  const email =
    FIXED_STUDENT_EMAIL || `visual-check-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@local.test`;

  await page.goto(`${baseUrl}/login?role=student`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  const registration = await page.evaluate(
    async ({ email, password, name }) => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-origin": window.location.origin
        },
        body: JSON.stringify({
          role: "student",
          email,
          password,
          name,
          grade: "4"
        })
      });
      const body = await response.json().catch(() => null);
      return { ok: response.ok, status: response.status, body };
    },
    { email, password: PASSWORD, name: STUDENT_NAME }
  );

  if (
    !registration.ok &&
    FIXED_STUDENT_EMAIL &&
    registration.status >= 400 &&
    registration.status < 500
  ) {
    // A fixed visual-check account may already exist from a prior run.
    console.warn(`Student registration skipped for ${email}: ${registration.status}`);
  } else if (!registration.ok) {
    throw new Error(`Student registration failed: ${registration.status} ${JSON.stringify(registration.body)}`);
  }

  const login = await page.evaluate(
    async ({ email, password }) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-origin": window.location.origin
        },
        body: JSON.stringify({
          email,
          password,
          role: "student"
        })
      });
      const body = await response.json().catch(() => null);
      return { ok: response.ok, status: response.status, body };
    },
    { email, password: PASSWORD }
  );

  if (!login.ok) {
    throw new Error(`Student login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }
}

async function collectThemeMetrics(page) {
  const root = page.locator("html");
  const toggle = page.locator(".theme-mode-toggle");
  const darkButton = page.getByRole("button", { name: getThemeButtonName("dark") });
  const lightButton = page.getByRole("button", { name: getThemeButtonName("light") });

  if (!(await toggle.count())) {
    return {
      themeTogglePresent: false,
      themeCycleSucceeded: false,
      initialRootClass: "",
      darkRootClass: "",
      lightRootClass: ""
    };
  }

  const initialRootClass = (await root.getAttribute("class")) ?? "";
  await darkButton.click();
  await page.waitForTimeout(waitAfterThemeToggleMs);
  const darkRootClass = (await root.getAttribute("class")) ?? "";

  await lightButton.click();
  await page.waitForTimeout(waitAfterThemeToggleMs);
  const lightRootClass = (await root.getAttribute("class")) ?? "";

  return {
    themeTogglePresent: true,
    themeCycleSucceeded: darkRootClass.includes("dark") && !lightRootClass.includes("dark"),
    initialRootClass,
    darkRootClass,
    lightRootClass
  };
}

async function dismissGuidedTourIfVisible(page) {
  const skipButton = page.getByRole("button", { name: "跳过" });
  if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click();
    await page.waitForLoadState("networkidle");
  }
}

async function collectPageMetrics(page, routeConfig, viewportName) {
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

  const themeMetrics = await collectThemeMetrics(page);
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
      "no-horizontal-overflow",
      !shellMetrics.overflowX,
      `scrollWidth=${shellMetrics.scrollWidth}, clientWidth=${shellMetrics.clientWidth}, bodyScrollWidth=${shellMetrics.bodyScrollWidth}`
    )
  );
  rules.push(
    createRuleResult(
      "theme-toggle-present",
      themeMetrics.themeTogglePresent,
      themeMetrics.themeTogglePresent ? "theme toggle located" : "missing .theme-mode-toggle"
    )
  );
  rules.push(
    createRuleResult(
      "theme-toggle-cycle",
      themeMetrics.themeCycleSucceeded,
      `initial=${themeMetrics.initialRootClass || "(empty)"} dark=${themeMetrics.darkRootClass || "(empty)"} light=${themeMetrics.lightRootClass || "(empty)"}`
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
    ...themeMetrics,
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
  return comparisons;
}

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
      const response = await publicPage.goto(`${baseUrl}${routeConfig.route}`, {
        waitUntil: "networkidle",
        timeout: 30_000
      });

      const result = await collectPageMetrics(publicPage, routeConfig, viewport.name);
      result.route = routeConfig.route;
      result.viewport = viewport.name;
      result.slug = routeConfig.slug || sanitizeSlug(routeConfig.route);
      result.expectedShell = routeConfig.expectedShell;
      result.status = response?.status() ?? 0;
      result.rules[0] = createRuleResult("http-status-ok", result.status >= 200 && result.status < 400, `status=${result.status}`);
      result.rules.push(...compareWithBaseline(result, baselineMap.get(`${routeConfig.route}::${viewport.name}`)));
      result.failedRules = result.rules.filter((rule) => !rule.passed);
      result.passed = result.failedRules.length === 0;

      await publicPage.screenshot({
        path: path.join(screenshotDir, `${result.slug}-${viewport.name}.png`),
        fullPage: true
      });

      if (!result.passed) {
        unexpectedFailures += 1;
      }
      results.push(result);
    }

    await publicContext.close();

    const authedContext = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const authedPage = await authedContext.newPage();
    await ensureStudentSession(authedPage);

    for (const routeConfig of authenticatedRoutes) {
      const response = await authedPage.goto(`${baseUrl}${routeConfig.route}`, {
        waitUntil: "networkidle",
        timeout: 30_000
      });

      await dismissGuidedTourIfVisible(authedPage);

      const result = await collectPageMetrics(authedPage, routeConfig, viewport.name);
      result.route = routeConfig.route;
      result.viewport = viewport.name;
      result.slug = routeConfig.slug || sanitizeSlug(routeConfig.route);
      result.expectedShell = routeConfig.expectedShell;
      result.status = response?.status() ?? 0;
      result.rules[0] = createRuleResult("http-status-ok", result.status >= 200 && result.status < 400, `status=${result.status}`);
      result.rules.push(...compareWithBaseline(result, baselineMap.get(`${routeConfig.route}::${viewport.name}`)));
      result.failedRules = result.rules.filter((rule) => !rule.passed);
      result.passed = result.failedRules.length === 0;

      await authedPage.screenshot({
        path: path.join(screenshotDir, `${result.slug}-${viewport.name}.png`),
        fullPage: true
      });

      if (!result.passed) {
        unexpectedFailures += 1;
      }
      results.push(result);
    }

    await authedContext.close();
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
  totalChecks: results.length,
  failedChecks: unexpectedFailures
};

console.log(JSON.stringify({ summary, results }, null, 2));

if (unexpectedFailures > maxFailures) {
  process.exitCode = 1;
}
