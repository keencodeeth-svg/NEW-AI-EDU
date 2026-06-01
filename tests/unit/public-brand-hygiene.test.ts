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

const FORBIDDEN_PUBLIC_PLACEHOLDERS = [
  /@demo\.com/i,
  /默认学校/,
  /知序实验学校/
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
