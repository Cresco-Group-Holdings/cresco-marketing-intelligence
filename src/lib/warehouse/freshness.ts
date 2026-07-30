import type { FreshnessState } from "@/lib/warehouse/constants";
import { getWarehouseConfig } from "@/lib/warehouse/config";

export type FreshnessInput = {
  lastSuccessfulSyncAt?: Date | null;
  expectedIntervalMinutes?: number | null;
  now?: Date;
};

export function computeFreshnessState(input: FreshnessInput): {
  state: FreshnessState;
  lagMinutes: number | null;
} {
  const now = input.now ?? new Date();
  const config = getWarehouseConfig();

  if (!input.lastSuccessfulSyncAt) {
    return { state: "UNKNOWN", lagMinutes: null };
  }

  const lagMinutes = Math.max(
    0,
    Math.floor((now.getTime() - input.lastSuccessfulSyncAt.getTime()) / 60_000),
  );
  const expected = input.expectedIntervalMinutes ?? config.defaultSyncIntervalMinutes;
  const staleThreshold = expected * config.staleMultiplier;
  const criticalThreshold = expected * config.criticalMultiplier;

  if (lagMinutes <= staleThreshold) {
    return { state: "FRESH", lagMinutes };
  }

  if (lagMinutes <= criticalThreshold) {
    return { state: "STALE", lagMinutes };
  }

  return { state: "CRITICAL", lagMinutes };
}
