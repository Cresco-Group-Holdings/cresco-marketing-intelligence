const counters = new Map<string, number>();
const gauges = new Map<string, number>();

export function incrementSeoCounter(name: string, delta = 1) {
  counters.set(name, (counters.get(name) ?? 0) + delta);
}

export function setSeoGauge(name: string, value: number) {
  gauges.set(name, value);
}

export function getSeoCounters(): Record<string, number> {
  return Object.fromEntries(counters);
}

export function getSeoGauges(): Record<string, number> {
  return Object.fromEntries(gauges);
}

export function getSeoMetricsSnapshot(): {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  timestamp: string;
} {
  return {
    counters: getSeoCounters(),
    gauges: getSeoGauges(),
    timestamp: new Date().toISOString(),
  };
}

export function resetSeoCounters() {
  counters.clear();
  gauges.clear();
}

/** Structured metric names for dashboards and alerting. */
export const SEO_METRIC_NAMES = {
  crawlsEnqueued: "crawls_enqueued",
  crawlsCompleted: "crawls_completed",
  crawlFailures: "crawl_failures",
  ssrfAttempts: "ssrf_attempts",
  blockedPages: "blocked_pages",
  httpFailures: "http_failures",
  oversizedPages: "oversized_pages",
  robotsFetchFailures: "robots_fetch_failures",
  parserErrors: "parser_errors",
  aiValidationErrors: "ai_validation_errors",
  aiGenerationFailures: "ai_generation_failures",
  rankSyncFailures: "rank_sync_failures",
  competitorCrawlFailures: "competitor_crawl_failures",
  refreshCandidatesCreated: "refresh_candidates_created",
  queueBacklog: "queue_backlog",
} as const;
