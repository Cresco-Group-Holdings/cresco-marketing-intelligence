import type { AnalyticsFreshnessState } from "@/lib/analytics-core/constants";
import {
  ANALYTICS_DEFAULT_FRESHNESS_INTERVAL_MINUTES,
  ANALYTICS_FRESHNESS_CRITICAL_MULTIPLIER,
  ANALYTICS_FRESHNESS_STALE_MULTIPLIER,
} from "@/lib/analytics-core/constants";

export type FreshnessInput = {
  lastDataAt?: Date | null;
  expectedIntervalMinutes?: number | null;
  now?: Date;
};

export function computeAnalyticsFreshness(input: FreshnessInput): {
  state: AnalyticsFreshnessState;
  lagMinutes: number | null;
} {
  const now = input.now ?? new Date();

  if (!input.lastDataAt) {
    return { state: "UNKNOWN", lagMinutes: null };
  }

  const lagMinutes = Math.max(
    0,
    Math.floor((now.getTime() - input.lastDataAt.getTime()) / 60_000),
  );
  const expected = input.expectedIntervalMinutes ?? ANALYTICS_DEFAULT_FRESHNESS_INTERVAL_MINUTES;
  const staleThreshold = expected * ANALYTICS_FRESHNESS_STALE_MULTIPLIER;
  const criticalThreshold = expected * ANALYTICS_FRESHNESS_CRITICAL_MULTIPLIER;

  if (lagMinutes <= staleThreshold) {
    return { state: "FRESH", lagMinutes };
  }
  if (lagMinutes <= criticalThreshold) {
    return { state: "STALE", lagMinutes };
  }
  return { state: "CRITICAL", lagMinutes };
}
