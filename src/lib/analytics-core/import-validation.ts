import { AppError } from "@/lib/errors";
import { assertBaseMetricImport } from "@/lib/analytics-core/metric-engine";
import { isKnownMetricKey } from "@/lib/analytics-core/metric-registry";
import { CURRENCY_METRIC_KEYS } from "@/lib/analytics-core/constants";
import type { AnalyticsImportRowInput } from "@/lib/validation/analytics-core";

export type ImportRowValidationResult =
  | { valid: true; row: AnalyticsImportRowInput; index: number }
  | { valid: false; index: number; errors: string[] };

export function validateImportRow(row: AnalyticsImportRowInput, index: number): ImportRowValidationResult {
  const errors: string[] = [];

  if (!isKnownMetricKey(row.metricKey)) {
    errors.push(`Unknown metric key "${row.metricKey}".`);
  }

  const baseCheck = assertBaseMetricImport(row.metricKey);
  if (!baseCheck.valid) {
    errors.push(baseCheck.error);
  }

  if (row.value < 0) {
    errors.push("Metric value cannot be negative.");
  }

  if (CURRENCY_METRIC_KEYS.has(row.metricKey) && !row.currency) {
    errors.push(`Currency is required for metric "${row.metricKey}".`);
  }

  if (errors.length > 0) {
    return { valid: false, index, errors };
  }

  return { valid: true, row, index };
}

export function validateImportRows(rows: AnalyticsImportRowInput[]) {
  const accepted: AnalyticsImportRowInput[] = [];
  const rejected: Array<{ index: number; errors: string[] }> = [];

  rows.forEach((row, index) => {
    const result = validateImportRow(row, index);
    if (result.valid) {
      accepted.push(result.row);
    } else {
      rejected.push({ index: result.index, errors: result.errors });
    }
  });

  return { accepted, rejected };
}

export function assertImportHasAcceptedRows(acceptedCount: number) {
  if (acceptedCount === 0) {
    throw new AppError("VALIDATION_ERROR", "Import batch contains no valid rows.");
  }
}
