import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const PUBLIC_AUTH_ENTRY_FILES = [
  "app/admin/register/page.tsx",
  "app/teacher/register/page.tsx",
  "app/school/register/page.tsx",
  "app/recover/page.tsx"
] as const;

const PUBLIC_PRODUCT_SURFACE_FILES = [
  "lib/classroom/brand.ts",
  "app/home.data.ts",
  "app/_components/HomeHeroSection.tsx",
  "app/layout.tsx",
  "app/_components/HomeRoleLaunchSection.tsx",
  "app/_components/HomeFirstDayFlowsSection.tsx",
  "app/school/useSchoolPageView.tsx",
  "app/student/interactive-classroom/page.tsx"
] as const;

const FORBIDDEN_PUBLIC_PLACEHOLDERS = [
  /@demo\.com/i,
  /默认学校/,
  /知序实验学校/
] as const;

const FORBIDDEN_FORMER_BRAND_COPY = [
  /知序/,
  /zhixu/i
] as const;

const FORBIDDEN_TEMPLATE_COPY = [
  /Role-first/,
  /Onboarding/,
  /School Admin/,
  /访客体验/
] as const;

test("public auth entry pages do not expose demo or placeholder school copy", () => {
  for (const relativePath of PUBLIC_AUTH_ENTRY_FILES) {
    const absolutePath = path.join(process.cwd(), relativePath);
    const source = fs.readFileSync(absolutePath, "utf8");

    for (const pattern of FORBIDDEN_PUBLIC_PLACEHOLDERS) {
      assert.doesNotMatch(source, pattern, `${relativePath} should not contain ${pattern}`);
    }
  }
});

test("public product surfaces do not expose template-style English chips", () => {
  for (const relativePath of PUBLIC_PRODUCT_SURFACE_FILES) {
    const absolutePath = path.join(process.cwd(), relativePath);
    const source = fs.readFileSync(absolutePath, "utf8");

    for (const pattern of FORBIDDEN_TEMPLATE_COPY) {
      assert.doesNotMatch(source, pattern, `${relativePath} should not contain ${pattern}`);
    }
  }
});

test("public product surfaces use Hangke as the canonical brand", () => {
  const brandSource = fs.readFileSync(path.join(process.cwd(), "lib/classroom/brand.ts"), "utf8");
  assert.match(brandSource, /航科教育/, "platform brand should use Hangke");
  assert.match(brandSource, /航科互动课堂/, "classroom product should use Hangke");

  for (const relativePath of PUBLIC_PRODUCT_SURFACE_FILES) {
    const absolutePath = path.join(process.cwd(), relativePath);
    const source = fs.readFileSync(absolutePath, "utf8");

    for (const pattern of FORBIDDEN_FORMER_BRAND_COPY) {
      assert.doesNotMatch(source, pattern, `${relativePath} should not contain former brand copy ${pattern}`);
    }
  }
});
