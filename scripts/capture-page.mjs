import fs from "fs/promises";
import path from "path";
import { chromium } from "@playwright/test";

function parseArgs(argv) {
  const options = {
    url: "/",
    baseUrl: "http://localhost:3127",
    output: "output/playwright/page-capture.png",
    viewportWidth: 1440,
    viewportHeight: 1120,
    waitMs: 1500,
    fullPage: true,
    selector: "",
    waitUntil: "networkidle",
    sessionStorageKey: "",
    sessionFile: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if ((value === "--url" || value === "-u") && argv[index + 1]) {
      options.url = argv[index + 1];
      index += 1;
      continue;
    }
    if ((value === "--output" || value === "-o") && argv[index + 1]) {
      options.output = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--base-url" && argv[index + 1]) {
      options.baseUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--width" && argv[index + 1]) {
      options.viewportWidth = Number(argv[index + 1]) || options.viewportWidth;
      index += 1;
      continue;
    }
    if (value === "--height" && argv[index + 1]) {
      options.viewportHeight = Number(argv[index + 1]) || options.viewportHeight;
      index += 1;
      continue;
    }
    if (value === "--wait" && argv[index + 1]) {
      options.waitMs = Number(argv[index + 1]) || options.waitMs;
      index += 1;
      continue;
    }
    if (value === "--selector" && argv[index + 1]) {
      options.selector = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--wait-until" && argv[index + 1]) {
      options.waitUntil = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--session-storage-key" && argv[index + 1]) {
      options.sessionStorageKey = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--session-file" && argv[index + 1]) {
      options.sessionFile = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--no-full-page") {
      options.fullPage = false;
      continue;
    }
  }

  return options;
}

async function ensureOutputDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function resolveUrl(baseUrl, targetUrl) {
  if (/^https?:\/\//.test(targetUrl)) {
    return targetUrl;
  }

  return `${baseUrl.replace(/\/$/, "")}/${targetUrl.replace(/^\//, "")}`;
}

async function main() {
  const cwd = process.cwd();
  const options = parseArgs(process.argv.slice(2));
  const outputPath = path.isAbsolute(options.output)
    ? options.output
    : path.join(cwd, options.output);
  const targetUrl = resolveUrl(options.baseUrl, options.url);

  await ensureOutputDir(outputPath);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: {
      width: options.viewportWidth,
      height: options.viewportHeight
    },
    deviceScaleFactor: 1
  });

  const consoleErrors = [];
  const failedRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(`console:${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(`page:${error.message}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedRequests.push({
        status: response.status(),
        url: response.url()
      });
    }
  });

  await page.goto(targetUrl, { waitUntil: options.waitUntil });
  if (options.sessionStorageKey && options.sessionFile) {
    const sessionFilePath = path.isAbsolute(options.sessionFile)
      ? options.sessionFile
      : path.join(cwd, options.sessionFile);
    const sessionRaw = await fs.readFile(sessionFilePath, "utf8");
    await page.evaluate(
      ({ sessionStorageKey, sessionRaw }) => {
        sessionStorage.setItem(sessionStorageKey, sessionRaw);
      },
      {
        sessionStorageKey: options.sessionStorageKey,
        sessionRaw
      }
    );
    await page.goto(targetUrl, { waitUntil: options.waitUntil });
  }
  if (options.selector) {
    await page.waitForSelector(options.selector, { state: "visible", timeout: 15000 });
  }
  if (options.waitMs > 0) {
    await page.waitForTimeout(options.waitMs);
  }

  await page.screenshot({
    path: outputPath,
    fullPage: options.fullPage
  });

  console.log(
    JSON.stringify(
      {
        url: targetUrl,
        output: outputPath,
        consoleErrors,
        failedRequests
      },
      null,
      2
    )
  );

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
