import type { CampaignPerformanceState } from "@/lib/paid-advertising/types";

const MIN_CONVERSIONS_FOR_STATE = 5;
const MIN_SPEND_FOR_STATE = 50;

export function mapCampaignStatus(status: string): import("@/lib/paid-advertising/types").CampaignStatus {
  const normalised = status.toUpperCase();
  if (normalised === "ACTIVE" || normalised === "ENABLED" || normalised === "LIVE") {
    return "Active";
  }
  if (normalised === "PAUSED") {
    return "Paused";
  }
  if (normalised === "ARCHIVED" || normalised === "REMOVED") {
    return "Archived";
  }
  if (normalised === "DRAFT") {
    return "Draft";
  }
  if (normalised === "ERROR") {
    return "Error";
  }
  return "Unknown";
}

export function calculateCampaignPerformanceState(input: {
  roas: number | null;
  cpa: number | null;
  conversions: number | null;
  spend: number | null;
  portfolioRoas: number | null;
  portfolioCpa: number | null;
}): CampaignPerformanceState {
  if (
    (input.conversions ?? 0) < MIN_CONVERSIONS_FOR_STATE &&
    (input.spend ?? 0) < MIN_SPEND_FOR_STATE
  ) {
    return "Insufficient data";
  }

  const roas = input.roas;
  const portfolioRoas = input.portfolioRoas;

  if (roas != null && portfolioRoas != null && portfolioRoas > 0) {
    const roasRatio = roas / portfolioRoas;
    if (roasRatio >= 1.25) {
      return "Strong";
    }
    if (roasRatio >= 0.9) {
      return "Healthy";
    }
    if (roasRatio >= 0.7) {
      return "Needs attention";
    }
    return "Underperforming";
  }

  if (input.cpa != null && input.portfolioCpa != null && input.portfolioCpa > 0) {
    const cpaRatio = input.cpa / input.portfolioCpa;
    if (cpaRatio <= 0.8) {
      return "Strong";
    }
    if (cpaRatio <= 1.0) {
      return "Healthy";
    }
    if (cpaRatio <= 1.3) {
      return "Needs attention";
    }
    return "Underperforming";
  }

  return "Insufficient data";
}

export function detectCreativeFatigue(input: {
  ctr: number | null;
  previousCtr: number | null;
  frequency: number | null;
  cpa: number | null;
  previousCpa: number | null;
}): { detected: boolean; reason: string | null } {
  const ctrDecline =
    input.ctr != null &&
    input.previousCtr != null &&
    input.previousCtr > 0 &&
    (input.previousCtr - input.ctr) / input.previousCtr >= 0.2;

  const cpaIncrease =
    input.cpa != null &&
    input.previousCpa != null &&
    input.previousCpa > 0 &&
    (input.cpa - input.previousCpa) / input.previousCpa >= 0.2;

  const highFrequency = (input.frequency ?? 0) >= 4;

  if (ctrDecline && highFrequency) {
    return {
      detected: true,
      reason: `CTR declined while frequency increased to ${input.frequency?.toFixed(1)}.`,
    };
  }

  if (ctrDecline && cpaIncrease) {
    return {
      detected: true,
      reason: "CTR declined alongside rising CPA during the comparison period.",
    };
  }

  return { detected: false, reason: null };
}
