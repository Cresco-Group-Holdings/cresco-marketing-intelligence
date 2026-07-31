export type ExperimentConfig = {
  sampleAllocationPercent: number;
  primaryMetric: string;
  minimumSample: number;
  decisionRule?: string;
  testDurationHours?: number;
};

export type VariantMetrics = {
  sampleSize: number;
  opens: number;
  clicks: number;
  conversions: number;
};

export type ExperimentResult = {
  winnerVariant: "A" | "B" | null;
  status: "COMPLETED" | "INSUFFICIENT_EVIDENCE" | "RUNNING";
  validityWarnings: string[];
};

export function allocateVariant(index: number, total: number, allocationPercent: number): "A" | "B" {
  const cutoff = Math.floor(total * (allocationPercent / 100));
  return index < cutoff ? "A" : "B";
}

export function evaluateExperiment(
  metricsA: VariantMetrics,
  metricsB: VariantMetrics,
  config: ExperimentConfig,
): ExperimentResult {
  const warnings: string[] = [];
  if (metricsA.sampleSize < config.minimumSample || metricsB.sampleSize < config.minimumSample) {
    warnings.push(`Minimum sample of ${config.minimumSample} not reached.`);
    return { winnerVariant: null, status: "INSUFFICIENT_EVIDENCE", validityWarnings: warnings };
  }

  const rateA = computeMetricRate(metricsA, config.primaryMetric);
  const rateB = computeMetricRate(metricsB, config.primaryMetric);
  const diff = Math.abs(rateA - rateB);
  const minDiff = 0.02;

  if (diff < minDiff) {
    warnings.push("Difference between variants is below significance threshold.");
    return { winnerVariant: null, status: "INSUFFICIENT_EVIDENCE", validityWarnings: warnings };
  }

  return {
    winnerVariant: rateA > rateB ? "A" : "B",
    status: "COMPLETED",
    validityWarnings: warnings,
  };
}

function computeMetricRate(metrics: VariantMetrics, primaryMetric: string): number {
  if (metrics.sampleSize === 0) return 0;
  switch (primaryMetric) {
    case "open_rate": return metrics.opens / metrics.sampleSize;
    case "click_rate": return metrics.clicks / metrics.sampleSize;
    case "conversion_rate": return metrics.conversions / metrics.sampleSize;
    default: return metrics.clicks / metrics.sampleSize;
  }
}
