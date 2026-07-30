export type GscSite = {
  siteUrl: string;
  permissionLevel: string;
};

export type GscSearchAnalyticsRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscSearchAnalyticsResult = {
  rows: GscSearchAnalyticsRow[];
  responseAggregationType?: string;
};

export type GscConnectorMetadata = {
  siteUrl?: string;
  siteType?: "domain" | "url_prefix";
  permissionLevel?: string;
  syncState?: {
    backfillStartDate?: string;
    lastSyncedDate?: string;
    lastReconciliationAt?: string;
    initialBackfillComplete?: boolean;
  };
};

export type GscSitemap = {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  warnings?: number;
  errors?: number;
  contents?: Array<{ type?: string; submitted?: number }>;
  isPending?: boolean;
};

export type GscUrlInspectionResult = {
  inspectionUrl: string;
  indexedState?: string;
  crawlState?: string;
  canonicalUrl?: string;
  robotsTxtState?: string;
  lastCrawlTime?: string;
  mobileUsability?: string;
  richResultsState?: string;
  raw: Record<string, unknown>;
};
