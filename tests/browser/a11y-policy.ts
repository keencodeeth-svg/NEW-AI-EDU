const STRICT_BLOCKED_IMPACTS = ["critical", "serious"] as const;

export type A11yImpact = (typeof STRICT_BLOCKED_IMPACTS)[number];

export function getBlockedA11yImpacts() {
  return new Set<A11yImpact>(STRICT_BLOCKED_IMPACTS);
}

export function isBlockedA11yImpact(impact: string | null | undefined) {
  if (!impact) return false;
  return getBlockedA11yImpacts().has(impact as A11yImpact);
}
