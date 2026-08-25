import type { AttributionModelType } from "@prisma/client";
import type { DataFreshnessState } from "@/lib/marketing-intelligence/types";

export type MetricKind = "Observed" | "Calculated" | "Attributed" | "Estimated" | "Unavailable";

export type MetricMetadata = {
  kind: MetricKind;
  source?: string[];
  attributionModel?: string;
  coverage?: number | null;
  limitations?: string[];
};

export type UnifiedKpi = {
  label: string;
  value: string;
  change: number | null;
  comparisonLabel: string;
  metadata: MetricMetadata;
  footnote?: string;
};

export type CoverageDimension = {
  dimension: string;
  state: "Strong" | "Partial" | "Limited" | "Unavailable";
  label: string;
  coveragePercent: number | null;
};

export type ChannelAnalyticsRow = {
  channel: string;
  sourceType: "paid" | "organic";
  spend: number | null;
  reach: number | null;
  impressions: number | null;
  clicks: number | null;
  engagement: number | null;
  conversions: number | null;
  attributedRevenue: number | null;
  roas: number | null;
  contributionPercent: number | null;
  assistPercent: number | null;
  freshness: DataFreshnessState;
  providerReportedConversions: number | null;
  crescoTrackedConversions: number | null;
};

export type ContentAnalyticsRow = {
  contentId: string;
  title: string;
  format: string | null;
  organicReach: number | null;
  organicEngagement: number | null;
  paidSpend: number | null;
  paidRoas: number | null;
  attributedConversions: number | null;
  attributedRevenue: number | null;
  assistedConversions: number | null;
  assistedRevenue: number | null;
  channels: string[];
};

export type FunnelStage = {
  stage: string;
  count: number | null;
  conversionRate: number | null;
  dropOffPercent: number | null;
};

export type ConversionRow = {
  id: string;
  conversionType: string;
  count: number;
  attributedChannel: string | null;
  attributedCampaign: string | null;
  attributedContent: string | null;
  revenue: number | null;
  model: string;
  coverage: number | null;
};

export type RevenueBreakdown = {
  observedRevenue: number | null;
  attributedRevenue: number | null;
  unattributedRevenue: number | null;
  paidAttributedRevenue: number | null;
  organicAssistedRevenue: number | null;
  attributionCoverage: number | null;
};

export type AttributionModelOption = {
  type: AttributionModelType;
  label: string;
  description: string;
};

export type ModelComparisonRow = {
  modelType: AttributionModelType;
  modelLabel: string;
  channel: string;
  contributionPercent: number;
  attributedRevenue: number;
};

export type JourneyFlow = {
  path: string[];
  conversions: number;
  revenue: number;
};

export type OrganicAssistSummary = {
  rate: number | null;
  paidConversionsWithPriorOrganic: number;
  totalPaidAttributedConversions: number;
  topAssistingChannel: string | null;
  description: string;
};

export type AttributionConfidenceLevel = "Low" | "Medium" | "High";

export type AttributionConfidenceSummary = {
  level: AttributionConfidenceLevel;
  label: string;
  sourceCoveragePercent: number | null;
  journeyCoveragePercent: number | null;
  limitations: string[];
};

export type WebAnalyticsSummary = {
  connected: boolean;
  sessions: number | null;
  users: number | null;
  pageviews: number | null;
  conversions: number | null;
  freshness: DataFreshnessState;
  lastSyncedAt: string | null;
  source: "GA4" | null;
};

export type UnifiedAnalyticsWorkspaceData = {
  hasBrandContext: boolean;
  dateRange: {
    label: string;
    comparisonLabel: string;
    from: string;
    to: string;
  };
  attributionModel: AttributionModelType;
  attributionModelLabel: string;
  lookbackWindowDays: number;
  freshness: { label: string; state: DataFreshnessState };
  coverage: CoverageDimension[];
  coverageWarnings: string[];
  executiveKpis: UnifiedKpi[];
  channels: ChannelAnalyticsRow[];
  content: ContentAnalyticsRow[];
  funnel: FunnelStage[];
  conversions: ConversionRow[];
  revenue: RevenueBreakdown;
  modelComparison: ModelComparisonRow[];
  journeyFlows: JourneyFlow[];
  organicAssist: OrganicAssistSummary;
  unattributed: {
    conversions: number;
    revenue: number | null;
  };
  attributionConfidence: AttributionConfidenceSummary;
  webAnalytics: WebAnalyticsSummary;
  insights: import("@/lib/marketing-intelligence/types").MarketingSignal[];
  disclaimer: string;
  modelOptions: AttributionModelOption[];
};
