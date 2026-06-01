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
        teacherDarkScreenshot: mod.getScreenshotFileName("teacher-classroom-live", "mobile", "dark"),
        routeMatrix: mod.getVisualRouteMatrix?.(),
        sessionGroups: mod.getVisualSessionGroups?.(),
        coverageSummary: mod.getVisualCoverageSummary?.()
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

test("visual check route matrix includes newly gated parent, school, admin, ai classroom, and interactive classroom pages", () => {
  const payload = readVisualCheckExports();

  assert.ok(payload.routeMatrix, "route matrix export should exist");
  assert.deepEqual(payload.routeMatrix.publicRoutes, ["/", "/login", "/register", "/recover", "/ai-classroom"]);
  assert.deepEqual(payload.routeMatrix.studentRoutes, ["/student", "/practice", "/student/interactive-classroom", "/student/exams"]);
  assert.deepEqual(payload.routeMatrix.parentRoutes, ["/parent"]);
  assert.deepEqual(payload.routeMatrix.schoolRoutes, ["/school", "/school/interactive-classrooms"]);
  assert.deepEqual(payload.routeMatrix.adminRoutes, ["/admin"]);
  assert.deepEqual(payload.routeMatrix.teacherRoutes, ["/teacher", "/teacher/classroom-live", "/teacher/lesson-planner"]);
});

test("visual check session groups expose stable role-specific setup for gated routes", () => {
  const payload = readVisualCheckExports();

  assert.ok(payload.sessionGroups, "session group export should exist");
  assert.deepEqual(payload.sessionGroups, {
    public: ["/", "/login", "/register", "/recover", "/ai-classroom"],
    student: ["/student", "/practice", "/student/interactive-classroom", "/student/exams"],
    parent: ["/parent"],
    teacher: ["/teacher", "/teacher/classroom-live", "/teacher/lesson-planner"],
    school: ["/school", "/school/interactive-classrooms"],
    admin: ["/admin"]
  });
});

test("visual check coverage summary reports route, viewport, and theme matrix counts", () => {
  const payload = readVisualCheckExports();

  assert.ok(payload.coverageSummary, "coverage summary export should exist");
  assert.equal(payload.coverageSummary.totalRoutes, 16);
  assert.deepEqual(payload.coverageSummary.viewportNames, ["desktop", "mobile"]);
  assert.deepEqual(payload.coverageSummary.themes, ["light", "dark"]);
  assert.equal(payload.coverageSummary.totalChecks, 64);
  assert.deepEqual(payload.coverageSummary.routeCountsBySession, {
    public: 5,
    student: 4,
    parent: 1,
    teacher: 3,
    school: 2,
    admin: 1
  });
});
