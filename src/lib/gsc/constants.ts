export const GSC_WEBMASTERS_API_BASE = "https://www.googleapis.com/webmasters/v3";
export const GSC_INSPECTION_API_BASE = "https://searchconsole.googleapis.com/v1";
export const GSC_READONLY_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export const GSC_DEFAULT_BACKFILL_DAYS = 90;
export const GSC_RECONCILIATION_DAYS = 3;
export const GSC_MAX_ROW_LIMIT = 25_000;
export const GSC_DATA_DELAY_DAYS = 2;
export const GSC_MAX_URL_INSPECTIONS_PER_DAY = 50;
export const GSC_TRANSFORMATION_VERSION = "2026-07-30.1";

export const GSC_ANONYMIZED_QUERY_PATTERNS = [
  /^other$/i,
  /^\(not set\)$/i,
  /^.*\.\.\.$/,
];

export const GSC_METRIC_MAP: Record<string, string> = {
  clicks: "clicks",
  impressions: "impressions",
  ctr: "ctr",
  position: "avg_position",
};
