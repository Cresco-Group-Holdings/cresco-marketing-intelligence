export type RobotsRule = {
  userAgent: string;
  allow: string[];
  disallow: string[];
};

export type ParsedRobots = {
  rules: RobotsRule[];
  sitemaps: string[];
  crawlDelay: number | null;
  warnings: string[];
};

function parseDirectiveLine(line: string): { key: string; value: string } | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const key = line.slice(0, colon).trim().toLowerCase();
  const value = line.slice(colon + 1).trim();
  if (!key || !value) return null;
  return { key, value };
}

export function parseRobotsTxt(content: string, ourUserAgent = "CrescoSEOBot"): ParsedRobots {
  const warnings: string[] = [];
  const sitemaps: string[] = [];
  let crawlDelay: number | null = null;
  const rules: RobotsRule[] = [];
  let current: RobotsRule | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.split("#")[0]?.trim() ?? "";
    if (!line) continue;

    const directive = parseDirectiveLine(line);
    if (!directive) {
      warnings.push(`Unparseable line: ${line.slice(0, 80)}`);
      continue;
    }

    const { key, value } = directive;

    if (key === "user-agent") {
      if (current) rules.push(current);
      current = { userAgent: value.toLowerCase(), allow: [], disallow: [] };
    } else if (key === "allow" && current) {
      current.allow.push(value);
    } else if (key === "disallow" && current) {
      current.disallow.push(value);
    } else if (key === "sitemap") {
      sitemaps.push(value);
    } else if (key === "crawl-delay") {
      const delay = Number(value);
      if (Number.isFinite(delay) && delay >= 0) {
        crawlDelay = Math.max(crawlDelay ?? 0, delay);
      } else {
        warnings.push(`Invalid crawl-delay: ${value}`);
      }
    }
  }

  if (current) rules.push(current);

  return { rules, sitemaps, crawlDelay, warnings };
}

function ruleMatches(rule: RobotsRule, userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  const pattern = rule.userAgent;
  if (pattern === "*") return true;
  return ua.includes(pattern);
}

function pathMatchesPattern(path: string, pattern: string): boolean {
  if (!pattern) return false;
  if (pattern === "/") return path === "/" || path.startsWith("/");
  if (pattern.endsWith("*")) {
    return path.startsWith(pattern.slice(0, -1));
  }
  if (pattern.endsWith("/")) {
    return path.startsWith(pattern);
  }
  return path === pattern || path.startsWith(`${pattern}/`);
}

export function isPathAllowed(
  parsed: ParsedRobots,
  path: string,
  userAgent: string,
): { allowed: boolean; matchedRule?: string } {
  const applicable = parsed.rules.filter((r) => ruleMatches(r, userAgent));
  if (applicable.length === 0) {
    const wildcard = parsed.rules.find((r) => r.userAgent === "*");
    if (!wildcard) return { allowed: true };
    applicable.push(wildcard);
  }

  let allowed = true;
  let matchedRule: string | undefined;

  for (const rule of applicable) {
    for (const disallow of rule.disallow) {
      if (pathMatchesPattern(path, disallow)) {
        allowed = false;
        matchedRule = `disallow:${disallow}`;
      }
    }
    for (const allow of rule.allow) {
      if (pathMatchesPattern(path, allow)) {
        allowed = true;
        matchedRule = `allow:${allow}`;
      }
    }
  }

  return { allowed, matchedRule };
}
