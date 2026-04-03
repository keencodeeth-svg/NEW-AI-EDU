import assert from "node:assert/strict";
import { test } from "node:test";

import {
  resolveLaunchReadinessOverallState,
  summarizeLaunchReadinessItems,
  type LaunchReadinessItem,
} from "../../lib/launch-readiness";

test("summarizeLaunchReadinessItems counts pass warn fail buckets", () => {
  const items: LaunchReadinessItem[] = [
    { key: "a", label: "A", state: "pass", message: "ok" },
    { key: "b", label: "B", state: "warn", message: "warn" },
    { key: "c", label: "C", state: "fail", message: "fail" },
    { key: "d", label: "D", state: "pass", message: "ok" },
  ];

  assert.deepEqual(summarizeLaunchReadinessItems(items), {
    pass: 2,
    warn: 1,
    fail: 1,
  });
});

test("resolveLaunchReadinessOverallState prioritizes fail over warn and pass", () => {
  assert.equal(
    resolveLaunchReadinessOverallState([
      { key: "a", label: "A", state: "pass", message: "ok" },
      { key: "b", label: "B", state: "warn", message: "warn" },
    ]),
    "warn"
  );

  assert.equal(
    resolveLaunchReadinessOverallState([
      { key: "a", label: "A", state: "pass", message: "ok" },
      { key: "b", label: "B", state: "fail", message: "fail" },
    ]),
    "fail"
  );

  assert.equal(
    resolveLaunchReadinessOverallState([
      { key: "a", label: "A", state: "pass", message: "ok" },
      { key: "b", label: "B", state: "pass", message: "ok" },
    ]),
    "pass"
  );
});
