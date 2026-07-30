import type { AnalysisInput } from "./analysis-inputs";

export type EvidencePackage = {
  dateRangeStart: Date;
  dateRangeEnd: Date;
  comparisonPeriodStart: Date | null;
  comparisonPeriodEnd: Date | null;
  provider: string | null;
  accountId: string | null;
  campaignId: string | null;
  metrics: Record<string, number>;
  metricDefinitions: Record<string, string>;
  currency: string;
  attributionModel: string;
  freshnessHours: number | null;
  qualityWarnings: string[];
  minimumVolume: number;
  minimumVolumeMet: boolean;
  activeExperimentStatus: Record<string, unknown> | null;
  recentMaterialChanges: Array<{ type: string; at: string; description: string }>;
};

const METRIC_DEFINITIONS: Record<string, string> = {
  impressions: "Total ad impressions in date range",
  clicks: "Total ad clicks in date range",
  spend: "Total advertising spend in account currency",
  conversions: "Attributed conversions per selected attribution model",
  revenue: "Attributed revenue per selected attribution model",
  ctr: "Clicks divided by impressions (%)",
  cpc: "Spend divided by clicks",
  cpa: "Spend divided by conversions",
  roas: "Revenue divided by spend",
  conversionRate: "Conversions divided by clicks (%)",
};

export function buildEvidencePackage(input: AnalysisInput): EvidencePackage {
  const impressions = input.metrics.impressions ?? 0;
  const clicks = input.metrics.clicks ?? 0;
  const spend = input.metrics.spend ?? 0;
  const conversions = input.metrics.conversions ?? 0;
  const revenue = input.metrics.revenue ?? 0;

  const metrics: Record<string, number> = {
    impressions,
    clicks,
    spend,
    conversions,
    revenue,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
    roas: spend > 0 ? revenue / spend : 0,
    conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
    benchmarkCpc: input.metrics.benchmarkCpc ?? 0,
    benchmarkCpa: input.metrics.benchmarkCpa ?? 0,
  };

  const qualityWarnings = [...(input.dataQuality.warnings ?? [])];
  if (!input.dataQuality.hasTracking) {
    qualityWarnings.push("Conversion tracking not confirmed active.");
  }
  if (input.dataQuality.freshnessHours !== null && input.dataQuality.freshnessHours > 48) {
    qualityWarnings.push(`Provider data is ${input.dataQuality.freshnessHours}h old.`);
  }

  const minimumVolumeMet = impressions >= input.minimumVolume;

  return {
    dateRangeStart: input.dateRangeStart,
    dateRangeEnd: input.dateRangeEnd,
    comparisonPeriodStart: input.comparisonPeriodStart,
    comparisonPeriodEnd: input.comparisonPeriodEnd,
    provider: input.provider ?? null,
    accountId: input.accountId ?? null,
    campaignId: input.campaignId ?? null,
    metrics,
    metricDefinitions: { ...METRIC_DEFINITIONS, ...input.metricDefinitions },
    currency: input.currency,
    attributionModel: input.attributionModel,
    freshnessHours: input.dataQuality.freshnessHours,
    qualityWarnings,
    minimumVolume: input.minimumVolume,
    minimumVolumeMet,
    activeExperimentStatus: input.activeExperiment ?? null,
    recentMaterialChanges: input.recentMaterialChanges ?? [],
  };
}
