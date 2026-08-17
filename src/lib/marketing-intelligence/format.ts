import type { DataFreshnessState } from "@/lib/marketing-intelligence/types";

const FRESH_MS = 2 * 60 * 60 * 1000;
const DELAYED_MS = 24 * 60 * 60 * 1000;

export function resolveDataFreshness(lastSyncedAt: Date | null, now = new Date()): DataFreshnessState {
  if (!lastSyncedAt) {
    return "unavailable";
  }

  const ageMs = now.getTime() - lastSyncedAt.getTime();
  if (ageMs <= FRESH_MS) {
    return "fresh";
  }
  if (ageMs <= DELAYED_MS) {
    return "delayed";
  }
  return "stale";
}

export function formatFreshnessLabel(
  state: DataFreshnessState,
  lastSyncedAt: Date | null,
  now = new Date(),
): string {
  if (state === "unavailable" || !lastSyncedAt) {
    return "Connection required";
  }

  const ageMinutes = Math.max(1, Math.round((now.getTime() - lastSyncedAt.getTime()) / 60_000));
  if (ageMinutes < 60) {
    return `Updated ${ageMinutes} min ago`;
  }

  const ageHours = Math.round(ageMinutes / 60);
  if (ageHours < 24) {
    return `Updated ${ageHours} hour${ageHours === 1 ? "" : "s"} ago`;
  }

  const ageDays = Math.round(ageHours / 24);
  return state === "stale" ? `Sync delayed (${ageDays}d ago)` : `Updated ${ageDays}d ago`;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) {
    return current > 0 ? 100 : null;
  }
  return ((current - previous) / previous) * 100;
}

export function unavailableValue(): string {
  return "—";
}

export function formatMetricValue(
  value: number | null | undefined,
  formatter: (value: number) => string,
): string {
  if (value == null) {
    return unavailableValue();
  }
  return formatter(value);
}
