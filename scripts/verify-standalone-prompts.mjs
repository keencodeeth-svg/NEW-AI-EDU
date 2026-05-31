import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const standaloneRoot = path.join(cwd, ".next", "standalone");
const projectPromptRoot = path.join(cwd, "lib", "generation", "prompts");
const requiredFiles = [
  path.join("snippets", "action-types.md"),
  path.join("snippets", "element-types.md"),
  path.join("snippets", "json-output-rules.md"),
  path.join("templates", "requirements-to-outlines", "system.md"),
  path.join("templates", "requirements-to-outlines", "user.md"),
];

function statOrNull(targetPath) {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

function fail(message) {
  console.error(`[verify-standalone-prompts] ${message}`);
  process.exit(1);
}

if (!statOrNull(standaloneRoot)?.isDirectory()) {
  fail(`Missing standalone output at ${standaloneRoot}. Run the build first.`);
}

if (!statOrNull(projectPromptRoot)?.isDirectory()) {
  fail(`Prompt directory not found at ${projectPromptRoot}.`);
}

const missingFiles = requiredFiles.filter((relativePath) => {
  const standalonePath = path.join(standaloneRoot, "lib", "generation", "prompts", relativePath);
  return !statOrNull(standalonePath)?.isFile();
});

if (missingFiles.length > 0) {
  fail(
    `Standalone build is missing prompt assets:\n${missingFiles
      .map((relativePath) => `- lib/generation/prompts/${relativePath}`)
      .join("\n")}`
  );
}

const rootPackageJsonPath = path.join(standaloneRoot, "package.json");
if (!statOrNull(rootPackageJsonPath)?.isFile()) {
  fail(`Missing ${rootPackageJsonPath}. Standalone output is incomplete.`);
}

console.log(
  `[verify-standalone-prompts] Verified ${requiredFiles.length} required prompt assets under ${standaloneRoot}.`
);
