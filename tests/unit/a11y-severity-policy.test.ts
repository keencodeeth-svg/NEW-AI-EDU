import assert from "node:assert/strict";
import { test } from "node:test";

const {
  getBlockedA11yImpacts,
  isBlockedA11yImpact
} = require("../../tests/browser/a11y-policy") as typeof import("../../tests/browser/a11y-policy");

test("a11y policy blocks critical and serious violations by default", () => {
  assert.deepEqual([...getBlockedA11yImpacts()].sort(), ["critical", "serious"]);
});

test("a11y policy ignores the legacy serious opt-in flag", () => {
  process.env.PLAYWRIGHT_A11Y_INCLUDE_SERIOUS = "false";
  try {
    assert.deepEqual([...getBlockedA11yImpacts()].sort(), ["critical", "serious"]);
  } finally {
    delete process.env.PLAYWRIGHT_A11Y_INCLUDE_SERIOUS;
  }
});

test("a11y policy ignores lower impact findings", () => {
  assert.equal(isBlockedA11yImpact("moderate"), false);
  assert.equal(isBlockedA11yImpact("minor"), false);
  assert.equal(isBlockedA11yImpact(null), false);
});
