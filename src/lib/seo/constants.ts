/** SEO crawler operational limits and defaults. */
export const SEO_CRAWL_DEFAULTS = {
  maxPages: 500,
  maxDepth: 5,
  requestConcurrency: 2,
  requestDelayMs: 500,
  requestTimeoutMs: 15_000,
  redirectLimit: 5,
  userAgent: "CrescoSEOBot/1.0 (+https://cresco.ai/bot)",
  respectRobotsTxt: true,
  followCanonical: true,
  maxAttempts: 3,
  leaseDurationMs: 5 * 60_000,
  heartbeatIntervalMs: 30_000,
  maxContentBytes: 2 * 1024 * 1024,
  maxSitemapDepth: 3,
  maxSitemapUrls: 50_000,
  maxSitemapDecompressedBytes: 50 * 1024 * 1024,
  maxRobotsCacheAgeMs: 24 * 60 * 60_000,
  ignoredExtensions: [
    ".pdf",
    ".zip",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".css",
    ".js",
    ".woff",
    ".woff2",
    ".mp4",
    ".mp3",
    ".avi",
    ".exe",
    ".dmg",
  ],
} as const;

export const URL_NORMALISATION_VERSION = 1;

export const SEO_ISSUE_RULE_VERSION = 1;

export const SEO_PARSER_VERSION = "1.0";

export const TRACKING_QUERY_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "_ga",
  "ref",
];
