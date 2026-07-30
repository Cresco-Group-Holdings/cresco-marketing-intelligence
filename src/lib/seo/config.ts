import { SEO_CRAWL_DEFAULTS } from "@/lib/seo/constants";

export function getSeoCrawlConfig() {
  return {
    maxCrawlsPerWorkerRun: Number(process.env.SEO_CRAWL_MAX_PER_RUN ?? 5),
    maxQueueItemsPerBatch: Number(process.env.SEO_CRAWL_QUEUE_BATCH ?? 10),
    leaseDurationMs: Number(process.env.SEO_CRAWL_LEASE_MS ?? SEO_CRAWL_DEFAULTS.leaseDurationMs),
    maxContentBytes: SEO_CRAWL_DEFAULTS.maxContentBytes,
    maxPages: SEO_CRAWL_DEFAULTS.maxPages,
    maxDepth: SEO_CRAWL_DEFAULTS.maxDepth,
    requestConcurrency: SEO_CRAWL_DEFAULTS.requestConcurrency,
    requestDelayMs: SEO_CRAWL_DEFAULTS.requestDelayMs,
    requestTimeoutMs: SEO_CRAWL_DEFAULTS.requestTimeoutMs,
    redirectLimit: SEO_CRAWL_DEFAULTS.redirectLimit,
    userAgent: SEO_CRAWL_DEFAULTS.userAgent,
  };
}
