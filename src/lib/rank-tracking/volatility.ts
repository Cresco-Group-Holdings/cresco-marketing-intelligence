import type { SeoRankChangeType } from "@prisma/client";
import {
  LARGE_POSITION_MOVEMENT,
  MIN_OBSERVATIONS_FOR_VOLATILITY,
  RAPID_CLICK_DECLINE_PCT,
  SIGNIFICANT_RANK_LOSS,
} from "@/lib/rank-tracking/constants";
import type { RankObservationPoint } from "@/lib/rank-tracking/rank-history";

export type VolatilitySignal = {
  changeType: SeoRankChangeType;
  severity: string;
  evidence: Record<string, unknown>;
};

export function detectVolatilitySignals(
  observations: RankObservationPoint[],
  serpFeatures?: Array<{ featureType: string; observedDate: string }>,
): VolatilitySignal[] {
  if (observations.length < MIN_OBSERVATIONS_FOR_VOLATILITY) return [];

  const signals: VolatilitySignal[] = [];
  const sorted = [...observations].sort((a, b) => a.observedDate.localeCompare(b.observedDate));
  const current = sorted.at(-1)!;
  const previous = sorted.at(-2)!;

  if (current.rank != null && previous.rank != null) {
    const delta = current.rank - previous.rank;
    if (delta >= LARGE_POSITION_MOVEMENT) {
      signals.push({
        changeType: "POSITION_LOSS",
        severity: delta >= SIGNIFICANT_RANK_LOSS ? "HIGH" : "MEDIUM",
        evidence: { previousRank: previous.rank, currentRank: current.rank, delta },
      });
    } else if (delta <= -LARGE_POSITION_MOVEMENT) {
      signals.push({
        changeType: "POSITION_GAIN",
        severity: "LOW",
        evidence: { previousRank: previous.rank, currentRank: current.rank, delta },
      });
    }
  }

  if (current.url && previous.url && current.url !== previous.url) {
    signals.push({
      changeType: "URL_SWITCH",
      severity: "MEDIUM",
      evidence: { previousUrl: previous.url, currentUrl: current.url },
    });
  }

  if (
    previous.impressions != null && previous.impressions > 0 &&
    current.impressions != null &&
    current.impressions < previous.impressions * 0.5
  ) {
    signals.push({
      changeType: "IMPRESSION_DROP",
      severity: "HIGH",
      evidence: { previousImpressions: previous.impressions, currentImpressions: current.impressions },
    });
  }

  if (
    previous.clicks != null && previous.clicks > 0 &&
    current.clicks != null &&
    current.clicks < previous.clicks * (1 - RAPID_CLICK_DECLINE_PCT)
  ) {
    signals.push({
      changeType: "CLICK_DECLINE",
      severity: "HIGH",
      evidence: { previousClicks: previous.clicks, currentClicks: current.clicks },
    });
  }

  const ranks = sorted.filter((o) => o.rank != null).map((o) => o.rank!);
  if (ranks.length >= MIN_OBSERVATIONS_FOR_VOLATILITY) {
    const variance = ranks.reduce((sum, r) => sum + Math.abs(r - ranks[0]), 0) / ranks.length;
    if (variance >= LARGE_POSITION_MOVEMENT) {
      signals.push({
        changeType: "UNSTABLE_RANKING",
        severity: "MEDIUM",
        evidence: { ranks, averageVariance: variance },
      });
    }
  }

  if (serpFeatures && serpFeatures.length >= 2) {
    const latest = serpFeatures.at(-1)!;
    const prev = serpFeatures.at(-2)!;
    if (latest.featureType !== prev.featureType) {
      signals.push({
        changeType: "SERP_FEATURE_CHANGE",
        severity: "LOW",
        evidence: { previousFeature: prev.featureType, currentFeature: latest.featureType },
      });
    }
  }

  return signals;
}
