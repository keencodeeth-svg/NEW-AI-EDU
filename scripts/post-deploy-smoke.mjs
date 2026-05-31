import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { spawn } from "node:child_process";

function fail(message) {
  console.error(`[post-deploy-smoke] ${message}`);
  process.exit(1);
}

function normalizeStatusList(rawValue) {
  return new Set(
    String(rawValue || "200")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value))
  );
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Command exited via signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Command exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

function requestUrl(targetUrl, expectedStatuses, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const requestImpl = url.protocol === "https:" ? httpsRequest : httpRequest;
    const headers = {};

    if (process.env.POST_DEPLOY_SMOKE_HEADER_NAME && process.env.POST_DEPLOY_SMOKE_HEADER_VALUE) {
      headers[process.env.POST_DEPLOY_SMOKE_HEADER_NAME] = process.env.POST_DEPLOY_SMOKE_HEADER_VALUE;
    }

    const request = requestImpl(
      url,
      {
        method: process.env.POST_DEPLOY_SMOKE_METHOD || "GET",
        headers,
        timeout: timeoutMs,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const statusCode = response.statusCode ?? 0;
          const body = Buffer.concat(chunks).toString("utf8");
          if (!expectedStatuses.has(statusCode)) {
            reject(
              new Error(
                `Unexpected status ${statusCode} for ${targetUrl}. Expected ${[
                  ...expectedStatuses,
                ].join(", ")}. Body: ${body.slice(0, 400)}`
              )
            );
            return;
          }
          resolve();
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error(`Timed out after ${timeoutMs}ms`));
    });
    request.on("error", reject);

    const body = process.env.POST_DEPLOY_SMOKE_BODY;
    if (body) {
      request.write(body);
    }
    request.end();
  });
}

const command = process.env.POST_DEPLOY_SMOKE_COMMAND?.trim();
const url = process.env.POST_DEPLOY_SMOKE_URL?.trim();
const timeoutMs = Number(process.env.POST_DEPLOY_SMOKE_TIMEOUT_MS || 10000);
const expectedStatuses = normalizeStatusList(process.env.POST_DEPLOY_SMOKE_EXPECT_STATUS);

if (!command && !url) {
  fail("Set POST_DEPLOY_SMOKE_COMMAND or POST_DEPLOY_SMOKE_URL.");
}

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  fail(`Invalid POST_DEPLOY_SMOKE_TIMEOUT_MS: ${process.env.POST_DEPLOY_SMOKE_TIMEOUT_MS}`);
}

if (command) {
  console.log(`[post-deploy-smoke] Running command: ${command}`);
  await runCommand(command);
}

if (url) {
  console.log(`[post-deploy-smoke] Checking URL: ${url}`);
  await requestUrl(url, expectedStatuses, timeoutMs);
}

console.log("[post-deploy-smoke] Smoke checks passed.");
