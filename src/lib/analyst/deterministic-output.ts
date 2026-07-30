import type { MarketingAnalystOutput } from "@/lib/ai/analyst-output-schemas";
import type { EvidencePackage } from "@/lib/analyst/evidence-package";
import { ANALYST_DISCLAIMER } from "@/lib/analyst/constants";

export function buildDeterministicAnalystOutput(evidence: EvidencePackage): MarketingAnalystOutput {
  const availableMetrics = evidence.metrics.filter((m) => m.available && m.value != null);
  const unavailable = evidence.unavailableData;

  const keyFindings: MarketingAnalystOutput["keyFindings"] = availableMetrics.slice(0, 5).map((metric) => ({
    statement: `${metric.label}: ${metric.value}${metric.changePercent != null ? ` (${metric.changePercent >= 0 ? "+" : ""}${metric.changePercent}% vs previous period)` : ""}`,
    claimType: "MEASURED_FACT" as const,
    evidenceKeys: [metric.key],
    confidence: "HIGH" as const,
  }));

  if (keyFindings.length === 0) {
    keyFindings.push({
      statement: "Insufficient synchronised data to produce findings for the selected period.",
      claimType: "UNAVAILABLE",
      evidenceKeys: ["visitors"],
      confidence: "LOW",
    });
  }

  const anomalyFindings = evidence.anomalies.slice(0, 3).map((a) => ({
    statement: `${a.metricKey} changed ${a.changePercent}% (${a.direction.toLowerCase()}) — detected via ${a.method}`,
    claimType: "DETERMINISTIC_CALCULATION" as const,
    evidenceKeys: [a.metricKey],
    confidence: "MEDIUM" as const,
  }));

  return {
    summary: availableMetrics.length > 0
      ? `Analysis based on ${availableMetrics.length} available metrics. ${ANALYST_DISCLAIMER}`
      : `No synchronised metrics available. ${unavailable.length} data gaps identified.`,
    keyFindings: [...keyFindings, ...anomalyFindings],
    evidenceReferences: evidence.metrics.map((m) => ({
      evidenceKey: m.key,
      evidenceLabel: m.label,
      value: m.value,
      claimType: m.available ? "MEASURED_FACT" : "UNAVAILABLE",
    })),
    possibleExplanations: evidence.anomalies.map((a) => ({
      explanation: `The change in ${a.metricKey} may be associated with channel or campaign shifts — further investigation required.`,
      claimType: "HYPOTHESIS" as const,
      confidence: "LOW" as const,
    })),
    recommendedActions: evidence.qualityWarnings.slice(0, 3).map((warning, index) => ({
      title: `Investigate: ${warning.slice(0, 80)}`,
      description: warning,
      actionType: "DATA_QUALITY_TASK" as const,
      priority: index + 1,
      measurementPlan: "Resolve data quality issue and re-run analysis.",
    })),
    measurementPlan: "Re-run analysis after data sources are synced and attribution gaps are resolved.",
    limitations: [
      ANALYST_DISCLAIMER,
      "Deterministic fallback — AI explanation unavailable.",
      ...evidence.qualityWarnings,
    ],
    unavailableData: unavailable,
  };
}
