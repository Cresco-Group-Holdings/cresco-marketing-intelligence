import type { MarketingObjectiveType } from "@prisma/client";
import type { MetricValue } from "@/lib/executive/types";

export type ObjectiveKpiSnapshot = {
  visitors?: MetricValue;
  leads?: MetricValue;
  qualifiedLeads?: MetricValue;
  signups?: MetricValue;
  trials?: MetricValue;
  customers?: MetricValue;
  revenue?: MetricValue;
  mrr?: MetricValue;
  organicTraffic?: MetricValue;
  socialEngagement?: MetricValue;
  marketingSpend?: MetricValue;
};

export function resolveObjectiveActual(
  objectiveType: MarketingObjectiveType,
  kpis: ObjectiveKpiSnapshot,
): MetricValue {
  const mapping: Record<MarketingObjectiveType, keyof ObjectiveKpiSnapshot> = {
    BRAND_AWARENESS: "socialEngagement",
    WEBSITE_TRAFFIC: "visitors",
    LEAD_GENERATION: "leads",
    DEMO_BOOKINGS: "qualifiedLeads",
    TRIAL_SIGNUPS: "trials",
    PAID_SUBSCRIPTIONS: "customers",
    COMMUNITY_GROWTH: "socialEngagement",
    EMAIL_LIST_GROWTH: "leads",
    SEO_GROWTH: "organicTraffic",
    CUSTOMER_RETENTION: "mrr",
  };

  const key = mapping[objectiveType];
  const metric = kpis[key];
  if (!metric) {
    return {
      available: false,
      value: null,
      unavailableReason: "No KPI mapping for this objective type.",
    };
  }
  return metric;
}

export function calculateObjectiveProgress(target: number, actual: MetricValue) {
  if (!actual.available || actual.value == null || target <= 0) {
    return {
      progressPercent: null as number | null,
      remaining: null as number | null,
      status: "unavailable" as const,
    };
  }

  const progressPercent = Math.min(100, (actual.value / target) * 100);
  const remaining = Math.max(0, target - actual.value);
  let status: "on_track" | "behind" | "achieved" | "unavailable" = "on_track";
  if (actual.value >= target) status = "achieved";
  else if (progressPercent < 50) status = "behind";

  return { progressPercent, remaining, status };
}
