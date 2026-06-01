import assert from "node:assert/strict";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

function readVisualCheckExports() {
  const moduleUrl = pathToFileURL(path.resolve("scripts/visual-check-local.mjs")).href;
  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const mod = await import(${JSON.stringify(moduleUrl)}); console.log(JSON.stringify({
        routeKey: mod.getResultKey("/teacher/classroom-live", "mobile", "dark"),
        homeLight: mod.getResultKey("/", "desktop", "light"),
        homeScreenshot: mod.getScreenshotFileName("home", "desktop", "light"),
        teacherDarkScreenshot: mod.getScreenshotFileName("teacher-classroom-live", "mobile", "dark")
      }));`
    ],
    { encoding: "utf8" }
  );

  return JSON.parse(output);
}

test("visual check report keys include route, viewport, and theme", () => {
  const payload = readVisualCheckExports();

  assert.equal(payload.homeLight, "/::desktop::light");
  assert.equal(payload.routeKey, "/teacher/classroom-live::mobile::dark");
});

test("visual check screenshot names include theme suffix", () => {
  const payload = readVisualCheckExports();

  assert.equal(payload.homeScreenshot, "home-desktop-light.png");
  assert.equal(payload.teacherDarkScreenshot, "teacher-classroom-live-mobile-dark.png");
});
