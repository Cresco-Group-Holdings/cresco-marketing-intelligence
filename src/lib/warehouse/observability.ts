import { logger } from "@/lib/logging";

export const WAREHOUSE_COUNTERS = [
  "warehouse.batches_created",
  "warehouse.batches_completed",
  "warehouse.batches_failed",
  "warehouse.records_ingested",
  "warehouse.records_deduped",
  "warehouse.records_normalised",
  "warehouse.records_rejected",
  "warehouse.quality_checks_run",
  "warehouse.quality_issues_found",
  "warehouse.aggregates_refreshed",
  "warehouse.imports_started",
  "warehouse.imports_completed",
  "warehouse.reprocess_runs",
] as const;

export type WarehouseCounter = (typeof WAREHOUSE_COUNTERS)[number];

const counters = new Map<WarehouseCounter, number>();

export function incrementWarehouseCounter(
  counter: WarehouseCounter,
  amount = 1,
  context?: Record<string, unknown>,
): number {
  const next = (counters.get(counter) ?? 0) + amount;
  counters.set(counter, next);
  logger.info(counter, { ...context, amount, total: next });
  return next;
}

export function readWarehouseCounters(): Record<string, number> {
  return Object.fromEntries(counters);
}

export function resetWarehouseCounters(): void {
  counters.clear();
}
