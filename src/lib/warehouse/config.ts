import {
  WAREHOUSE_DEFAULT_QUERY_DAYS,
  WAREHOUSE_MAX_BATCH_SIZE,
  WAREHOUSE_MAX_IMPORT_ROWS,
  WAREHOUSE_MAX_LIST_LIMIT,
  WAREHOUSE_MAX_QUERY_DAYS,
} from "@/lib/warehouse/constants";

const number = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
};

export type WarehouseConfig = {
  enabled: boolean;
  maxQueryDays: number;
  defaultQueryDays: number;
  maxListLimit: number;
  maxBatchSize: number;
  maxImportRows: number;
  defaultSyncIntervalMinutes: number;
  staleMultiplier: number;
  criticalMultiplier: number;
  maxReprocessRecords: number;
};

export function getWarehouseConfig(): WarehouseConfig {
  return {
    enabled: (process.env.MARKETING_WAREHOUSE_ENABLED ?? "true").toLowerCase() !== "false",
    maxQueryDays: number(process.env.MARKETING_WAREHOUSE_MAX_QUERY_DAYS, WAREHOUSE_MAX_QUERY_DAYS, 1, 730),
    defaultQueryDays: number(
      process.env.MARKETING_WAREHOUSE_DEFAULT_QUERY_DAYS,
      WAREHOUSE_DEFAULT_QUERY_DAYS,
      1,
      366,
    ),
    maxListLimit: number(process.env.MARKETING_WAREHOUSE_MAX_LIST_LIMIT, WAREHOUSE_MAX_LIST_LIMIT, 1, 500),
    maxBatchSize: number(process.env.MARKETING_WAREHOUSE_MAX_BATCH_SIZE, WAREHOUSE_MAX_BATCH_SIZE, 1, 50_000),
    maxImportRows: number(
      process.env.MARKETING_WAREHOUSE_MAX_IMPORT_ROWS,
      WAREHOUSE_MAX_IMPORT_ROWS,
      1,
      100_000,
    ),
    defaultSyncIntervalMinutes: number(
      process.env.MARKETING_WAREHOUSE_SYNC_INTERVAL_MINUTES,
      360,
      15,
      10_080,
    ),
    staleMultiplier: number(process.env.MARKETING_WAREHOUSE_STALE_MULTIPLIER, 2, 1, 10),
    criticalMultiplier: number(process.env.MARKETING_WAREHOUSE_CRITICAL_MULTIPLIER, 4, 2, 20),
    maxReprocessRecords: number(process.env.MARKETING_WAREHOUSE_MAX_REPROCESS, 1_000, 1, 10_000),
  };
}
