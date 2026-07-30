/** Simple glob-style path rule matching for include/exclude crawl rules. */
export function matchesPathRule(path: string, rule: string): boolean {
  const normalised = path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;
  if (rule === "*") return true;
  if (rule.endsWith("*")) {
    return normalised.startsWith(rule.slice(0, -1));
  }
  return normalised === rule || normalised.startsWith(`${rule}/`);
}

export function isPathIncluded(
  path: string,
  includeRules: string[],
  excludeRules: string[],
): { allowed: boolean; reason?: string } {
  if (excludeRules.some((rule) => matchesPathRule(path, rule))) {
    return { allowed: false, reason: "excluded_by_rule" };
  }
  if (includeRules.length === 0) return { allowed: true };
  if (includeRules.some((rule) => matchesPathRule(path, rule))) {
    return { allowed: true };
  }
  return { allowed: false, reason: "not_in_include_rules" };
}
