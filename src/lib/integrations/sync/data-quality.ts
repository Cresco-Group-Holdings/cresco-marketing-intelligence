import type { CanonicalMetricRecord } from "@/lib/integrations/sync/types";

export type DataQualityWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};

export function validateMetricRecord(record: CanonicalMetricRecord): DataQualityWarning[] {
  const warnings: DataQualityWarning[] = [];

  if (!record.occurredAt) {
    warnings.push({
      code: "MISSING_OCCURRED_AT",
      message: "Metric record is missing occurredAt timestamp.",
      severity: "error",
    });
  }

  if (record.metrics.spend !== undefined && !record.currency) {
    warnings.push({
      code: "MISSING_CURRENCY",
      message: "Spend metric present without currency.",
      severity: "warning",
    });
  }

  const metricValues = Object.values(record.metrics);
  if (metricValues.some((value) => value < 0)) {
    warnings.push({
      code: "NEGATIVE_METRIC",
      message: "One or more metric values are negative.",
      severity: "warning",
    });
  }

  if (Object.keys(record.metrics).length === 0) {
    warnings.push({
      code: "EMPTY_METRICS",
      message: "Metric record contains no metric values.",
      severity: "warning",
    });
  }

  return warnings;
}

export function normaliseTimezone(timezone?: string): string {
  if (!timezone) return "UTC";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

export function computeFreshness(lastSyncedAt: Date | null, thresholdHours = 24): {
  fresh: boolean;
  staleHours: number | null;
} {
  if (!lastSyncedAt) return { fresh: false, staleHours: null };
  const staleHours = (Date.now() - lastSyncedAt.getTime()) / (1000 * 60 * 60);
  return { fresh: staleHours <= thresholdHours, staleHours };
}

export function detectDuplicateChecksum(
  existingChecksum: string | null | undefined,
  incomingChecksum: string | undefined,
): boolean {
  if (!existingChecksum || !incomingChecksum) return false;
  return existingChecksum === incomingChecksum;
}
