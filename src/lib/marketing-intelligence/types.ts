export type MarketingSignalType =
  | "opportunity"
  | "anomaly"
  | "budget"
  | "creative-fatigue"
  | "audience"
  | "organic"
  | "cross-channel";

export type MarketingSignalSeverity = "info" | "medium" | "high";

export type MarketingSignalEvidence = {
  label: string;
  value: string;
};

export type MarketingSignalAction = {
  label: string;
  href?: string;
};

export type MarketingSignal = {
  id: string;
  type: MarketingSignalType;
  severity: MarketingSignalSeverity;
  title: string;
  explanation: string;
  evidence: MarketingSignalEvidence[];
  estimatedImpact?: string;
  action?: MarketingSignalAction;
  category: "paid" | "organic" | "cross-channel";
  generatedAt: string;
  confidence: number;
};

export type PaidProviderMetrics = {
  provider: string;
  spend: number;
  conversions: number;
  revenue: number;
  clicks: number;
  impressions: number;
};

export type OrganicChannelPerformance = {
  provider: string;
  channel: string;
  connected: boolean;
  reach: number | null;
  views: number | null;
  engagement: number | null;
  engagementRate: number | null;
  followers: number | null;
  followerGrowth: number | null;
  shares: number | null;
  saves: number | null;
  published: number;
  scheduled: number;
  dataFreshness: Date | null;
  unavailableMetrics: string[];
};

export type DataFreshnessState = "fresh" | "delayed" | "stale" | "unavailable";

export type MarketingIntelligenceContext = {
  rangeLabel: string;
  comparisonLabel: string;
  paid: {
    connectedCount: number;
    totalProviders: number;
    spend: number;
    previousSpend: number;
    conversions: number;
    previousConversions: number;
    revenue: number;
    previousRevenue: number;
    roas: number | null;
    previousRoas: number | null;
    cpa: number | null;
    previousCpa: number | null;
    byProvider: PaidProviderMetrics[];
    freshness: DataFreshnessState;
    lastSyncedAt: Date | null;
  };
  organic: {
    connectedCount: number;
    totalProviders: number;
    reach: number | null;
    previousReach: number | null;
    engagement: number | null;
    previousEngagement: number | null;
    engagementRate: number | null;
    published: number;
    scheduled: number;
    channels: OrganicChannelPerformance[];
    freshness: DataFreshnessState;
    lastSyncedAt: Date | null;
    partialCoverageNote?: string;
  };
  publishing: {
    publishedInRange: number;
    scheduledUpcoming: number;
    daysWithoutScheduled: number | null;
    strongestOrganicFormat: string | null;
  };
  connectivity: {
    paidConnected: number;
    paidTotal: number;
    organicConnected: number;
    organicTotal: number;
  };
};

export type MarketingHealthBreakdown = {
  total: number;
  components: Array<{
    key: string;
    label: string;
    score: number;
    maxScore: number;
    detail: string;
  }>;
};

export interface MarketingSignalRule {
  id: string;
  evaluate(context: MarketingIntelligenceContext): MarketingSignal | null;
}
