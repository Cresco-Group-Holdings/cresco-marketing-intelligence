import {
  HIGH_CPA_MULTIPLIER,
  HIGH_CPC_MULTIPLIER,
  LOW_CTR_THRESHOLD,
  LOW_ROAS_THRESHOLD,
  STALE_DATA_HOURS,
} from "./constants";
import type { EvidencePackage } from "./evidence";

export type FindingCandidate = {
  findingType: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  description: string;
  suppressed: boolean;
  suppressionReason: string | null;
};

export function deriveFindings(evidence: EvidencePackage): FindingCandidate[] {
  const findings: FindingCandidate[] = [];
  const { metrics, minimumVolumeMet, qualityWarnings, activeExperimentStatus } = evidence;
  const suppress = !minimumVolumeMet;
  const suppressionReason = suppress ? "Insufficient sample volume for reliable finding." : null;

  if (!evidence.minimumVolumeMet && metrics.impressions > 0) {
    findings.push({
      findingType: "OTHER",
      severity: "INFO",
      title: "Insufficient sample volume",
      description: `Impressions (${metrics.impressions}) below minimum volume (${evidence.minimumVolume}).`,
      suppressed: true,
      suppressionReason,
    });
  }

  if (qualityWarnings.some((w) => w.includes("tracking"))) {
    findings.push({
      findingType: "TRACKING_FAILURE",
      severity: "CRITICAL",
      title: "Tracking failure suspected",
      description: "Conversion tracking is not confirmed or has quality warnings.",
      suppressed: suppress,
      suppressionReason,
    });
  }

  if (evidence.freshnessHours !== null && evidence.freshnessHours > STALE_DATA_HOURS) {
    findings.push({
      findingType: "PROVIDER_DATA_STALE",
      severity: "WARNING",
      title: "Stale provider data",
      description: `Data freshness is ${evidence.freshnessHours}h (threshold ${STALE_DATA_HOURS}h).`,
      suppressed: false,
      suppressionReason: null,
    });
  }

  if (metrics.ctr < LOW_CTR_THRESHOLD && metrics.impressions >= 500) {
    findings.push({
      findingType: "LOW_CTR",
      severity: "WARNING",
      title: "Low click-through rate",
      description: `CTR ${metrics.ctr.toFixed(2)}% is below threshold ${LOW_CTR_THRESHOLD}%.`,
      suppressed: suppress,
      suppressionReason,
    });
  }

  if (metrics.cpc > 0 && metrics.benchmarkCpc > 0 && metrics.cpc > metrics.benchmarkCpc * HIGH_CPC_MULTIPLIER) {
    findings.push({
      findingType: "HIGH_CPC",
      severity: "WARNING",
      title: "High cost per click",
      description: `CPC ${metrics.cpc.toFixed(2)} exceeds ${HIGH_CPC_MULTIPLIER}x benchmark.`,
      suppressed: suppress,
      suppressionReason,
    });
  }

  if (metrics.cpa > 0 && metrics.benchmarkCpa > 0 && metrics.cpa > metrics.benchmarkCpa * HIGH_CPA_MULTIPLIER) {
    findings.push({
      findingType: "HIGH_CPA",
      severity: "WARNING",
      title: "High cost per acquisition",
      description: `CPA ${metrics.cpa.toFixed(2)} exceeds ${HIGH_CPA_MULTIPLIER}x benchmark.`,
      suppressed: suppress,
      suppressionReason,
    });
  }

  if (metrics.spend > 0 && metrics.roas < LOW_ROAS_THRESHOLD && metrics.conversions > 0) {
    findings.push({
      findingType: "HIGH_SPEND_LOW_RETURN",
      severity: "WARNING",
      title: "High spend with low return",
      description: `ROAS ${metrics.roas.toFixed(2)} is below threshold ${LOW_ROAS_THRESHOLD}.`,
      suppressed: suppress,
      suppressionReason,
    });
  }

  if (metrics.conversionRate < 1 && metrics.clicks >= 200) {
    findings.push({
      findingType: "LOW_CONVERSION_RATE",
      severity: "INFO",
      title: "Low conversion rate",
      description: `Conversion rate ${metrics.conversionRate.toFixed(2)}% may indicate funnel or landing-page issues.`,
      suppressed: suppress,
      suppressionReason,
    });
  }

  if (metrics.roas >= 3 && metrics.conversions >= 10) {
    findings.push({
      findingType: "STRONG_CAMPAIGN",
      severity: "INFO",
      title: "Strong campaign performance",
      description: `ROAS ${metrics.roas.toFixed(2)} with ${metrics.conversions} conversions.`,
      suppressed: false,
      suppressionReason: null,
    });
  }

  if (activeExperimentStatus && activeExperimentStatus.isValid === false) {
    findings.push({
      findingType: "INVALID_EXPERIMENT",
      severity: "WARNING",
      title: "Invalid active experiment",
      description: "Active experiment has validity issues that may confound optimisation decisions.",
      suppressed: false,
      suppressionReason: null,
    });
  }

  return findings;
}
