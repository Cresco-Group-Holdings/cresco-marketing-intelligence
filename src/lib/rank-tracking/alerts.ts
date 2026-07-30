import type { SeoRankChangeType } from "@prisma/client";
import {
  ALERT_COOLDOWN_HOURS,
  MIN_IMPRESSIONS_FOR_ALERT,
  SIGNIFICANT_RANK_LOSS,
} from "@/lib/rank-tracking/constants";

export type AlertCandidate = {
  changeType: SeoRankChangeType;
  severity: string;
  evidence: Record<string, unknown>;
  trackedKeywordId: string;
};

export function shouldTriggerAlert(
  candidate: AlertCandidate,
  lastAlertAt?: Date | null,
  impressions?: number | null,
): boolean {
  if (lastAlertAt) {
    const hoursSince = (Date.now() - lastAlertAt.getTime()) / 3600000;
    if (hoursSince < ALERT_COOLDOWN_HOURS) return false;
  }

  const alertTypes: SeoRankChangeType[] = [
    "POSITION_LOSS",
    "TOP_10_ENTRY",
    "URL_SWITCH",
    "CLICK_DECLINE",
    "IMPRESSION_DROP",
    "PROVIDER_SYNC_FAILURE",
  ];
  if (!alertTypes.includes(candidate.changeType)) return false;

  if (
    candidate.changeType === "POSITION_LOSS" &&
    impressions != null &&
    impressions < MIN_IMPRESSIONS_FOR_ALERT
  ) {
    const delta = (candidate.evidence.delta as number) ?? 0;
    return delta >= SIGNIFICANT_RANK_LOSS;
  }

  if (candidate.changeType === "CLICK_DECLINE" || candidate.changeType === "IMPRESSION_DROP") {
    return impressions == null || impressions >= MIN_IMPRESSIONS_FOR_ALERT;
  }

  return true;
}

export function isProviderStale(lastSyncAt: Date | null | undefined, staleDays: number): boolean {
  if (!lastSyncAt) return true;
  const daysSince = (Date.now() - lastSyncAt.getTime()) / 86400000;
  return daysSince > staleDays;
}
