import type { AnalyticsDataCoverageState } from "@/lib/analytics-core/constants";
import { BASE_METRIC_KEYS } from "@/lib/analytics-core/constants";

export type CoverageInput = {
  presentMetricKeys: string[];
  expectedMetricKeys?: string[];
  hasFacts: boolean;
};

export function resolveDataCoverageState(input: CoverageInput): {
  state: AnalyticsDataCoverageState;
  missingMetricKeys: string[];
  warnings: string[];
} {
  const expected = input.expectedMetricKeys ?? [...BASE_METRIC_KEYS];
  const present = new Set(input.presentMetricKeys);
  const missingMetricKeys = expected.filter((key) => !present.has(key));
  const warnings: string[] = [];

  if (!input.hasFacts) {
    return {
      state: "NO_DATA",
      missingMetricKeys: expected,
      warnings: ["No analytics facts are available for the selected filters."],
    };
  }

  if (missingMetricKeys.length > 0) {
    warnings.push(
      `Partial data: missing base metrics (${missingMetricKeys.slice(0, 5).join(", ")}${missingMetricKeys.length > 5 ? ", …" : ""}).`,
    );
    return { state: "PARTIAL", missingMetricKeys, warnings };
  }

  return { state: "COMPLETE", missingMetricKeys: [], warnings };
}
