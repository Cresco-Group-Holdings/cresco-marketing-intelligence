import { COMPETITOR_CRAWL_DEFAULTS } from "@/lib/competitors/constants";
import { assertCrawlUrl, validateCrawlUrl } from "@/lib/seo/ssrf-guard";

export type CompetitorCrawlPolicy = {
  maxPages: number;
  maxDepth: number;
  requestConcurrency: number;
  requestDelayMs: number;
  requestTimeoutMs: number;
  redirectLimit: number;
  maxContentBytes: number;
  userAgent: string;
  respectRobotsTxt: boolean;
};

export function getCompetitorCrawlPolicy(
  overrides?: Partial<CompetitorCrawlPolicy>,
): CompetitorCrawlPolicy {
  return { ...COMPETITOR_CRAWL_DEFAULTS, ...overrides };
}

export function validateCompetitorDomain(hostname: string): { valid: boolean; reason?: string } {
  const normalised = hostname.toLowerCase().replace(/\.$/, "");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(normalised)) {
    return { valid: false, reason: "Invalid domain format." };
  }
  const testUrl = `https://${normalised}/`;
  const result = validateCrawlUrl(testUrl, [normalised], true);
  if (!result.allowed) {
    return { valid: false, reason: result.reason };
  }
  return { valid: true };
}

export function assertCompetitorUrlAllowed(url: string, allowedHostnames: string[]): void {
  assertCrawlUrl(url, allowedHostnames, true);
}

export function isBlockedCrawlPath(path: string): boolean {
  const lower = path.toLowerCase();
  const blockedPatterns = [
    "/login", "/signin", "/sign-in", "/auth", "/admin", "/wp-admin",
    "/account", "/checkout", "/cart", "/api/", "/.env", "/config",
  ];
  return blockedPatterns.some((p) => lower.includes(p));
}

export function truncateExcerpt(text: string, maxLength = 500): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}
