const counters = new Map<string, number>();
const gauges = new Map<string, number>();
const histograms = new Map<string, number[]>();

export function incrementAdvertisingCounter(name: string, delta = 1) {
  counters.set(name, (counters.get(name) ?? 0) + delta);
}

export function setAdvertisingGauge(name: string, value: number) {
  gauges.set(name, value);
}

export function recordAdvertisingDuration(name: string, durationMs: number) {
  const existing = histograms.get(name) ?? [];
  existing.push(durationMs);
  histograms.set(name, existing);
}

export function getAdvertisingCounters(): Record<string, number> {
  return Object.fromEntries(counters);
}

export function getAdvertisingGauges(): Record<string, number> {
  return Object.fromEntries(gauges);
}

export function getAdvertisingHistograms(): Record<string, { count: number; avgMs: number; maxMs: number }> {
  const result: Record<string, { count: number; avgMs: number; maxMs: number }> = {};
  for (const [name, values] of histograms) {
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    result[name] = { count, avgMs: count > 0 ? sum / count : 0, maxMs: count > 0 ? Math.max(...values) : 0 };
  }
  return result;
}

export function getAdvertisingMetricsSnapshot(): {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, { count: number; avgMs: number; maxMs: number }>;
  timestamp: string;
} {
  return {
    counters: getAdvertisingCounters(),
    gauges: getAdvertisingGauges(),
    histograms: getAdvertisingHistograms(),
    timestamp: new Date().toISOString(),
  };
}

export function resetAdvertisingMetrics() {
  counters.clear();
  gauges.clear();
  histograms.clear();
}

export function isAdvertisingEmergencyShutdown(): boolean {
  return process.env.ADVERTISING_EMERGENCY_SHUTDOWN === "true";
}

/** Structured metric names for dashboards and alerting. */
export const ADVERTISING_METRIC_NAMES = {
  providerConnectionHealthy: "provider_connection_healthy",
  providerConnectionFailures: "provider_connection_failures",
  validationFailures: "validation_failures",
  launchSuccess: "launch_success",
  launchFailure: "launch_failure",
  partialMutation: "partial_mutation",
  mutationDurationMs: "mutation_duration_ms",
  duplicatePreventionHits: "duplicate_prevention_hits",
  budgetAlerts: "budget_alerts",
  emergencyPauses: "emergency_pauses",
  policyRejections: "policy_rejections",
  experimentValidityFailures: "experiment_validity_failures",
  optimisationRecommendations: "optimisation_recommendations",
  aiCostTokens: "ai_cost_tokens",
  approvalDurationMs: "approval_duration_ms",
  unauthorisedMutationAttempts: "unauthorised_mutation_attempts",
  staleApprovalInvalidations: "stale_approval_invalidations",
  providerStateDrift: "provider_state_drift",
  idempotencyKeyCollisions: "idempotency_key_collisions",
} as const;
