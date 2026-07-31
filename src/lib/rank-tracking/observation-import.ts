import type { SeoRankDataSource, SeoRankDevice, SeoRankResultType } from "@prisma/client";

export type ObservationImportRow = {
  source: SeoRankDataSource;
  keyword: string;
  location: string;
  language: string;
  device: SeoRankDevice;
  observedDate: string;
  rank: number | null;
  rankingUrl?: string | null;
  resultType?: SeoRankResultType;
  impressions?: number | null;
  clicks?: number | null;
  ctr?: number | null;
  providerMetadata?: Record<string, unknown>;
};

export function validateObservationRow(row: ObservationImportRow): string[] {
  const errors: string[] = [];
  if (!row.keyword?.trim()) errors.push("keyword is required");
  if (!row.observedDate) errors.push("observedDate is required");
  if (!row.source) errors.push("source is required");
  if (row.rank != null && (row.rank < 1 || row.rank > 100)) {
    errors.push("rank must be between 1 and 100 or null");
  }
  return errors;
}

export function buildIdempotencyKey(row: ObservationImportRow, trackedKeywordId: string): string {
  return `${trackedKeywordId}:${row.source}:${row.observedDate}:${row.device}:${row.resultType ?? "ORGANIC"}`;
}
