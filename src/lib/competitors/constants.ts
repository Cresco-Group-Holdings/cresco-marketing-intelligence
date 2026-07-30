/** Restricted competitor crawl policy — public pages only. */
export const COMPETITOR_CRAWL_DEFAULTS = {
  maxPages: 50,
  maxDepth: 3,
  requestConcurrency: 1,
  requestDelayMs: 1000,
  requestTimeoutMs: 15000,
  redirectLimit: 3,
  maxContentBytes: 1 * 1024 * 1024,
  userAgent: "CrescoCompetitorBot/1.0 (+https://cresco.ai/bot; public-research)",
  respectRobotsTxt: true,
  allowFormSubmission: false,
  allowAuthenticatedAreas: false,
  allowPersonalDataHarvesting: false,
  allowApiDiscovery: false,
} as const;

export const COMPETITOR_EVIDENCE_MAX_EXCERPT = 500;
