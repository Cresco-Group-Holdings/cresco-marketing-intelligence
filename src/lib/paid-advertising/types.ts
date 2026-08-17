import type { DataFreshnessState } from "@/lib/marketing-intelligence/types";
import type { MarketingMetric } from "@/components/marketing/marketing-metric-card";
import type { PaidChartMetric, PaidChartPoint } from "@/components/marketing/paid-performance-chart";

export type CampaignStatus =
  | "Draft"
  | "Scheduled"
  | "Active"
  | "Paused"
  | "Completed"
  | "Archived"
  | "Error"
  | "Unknown";

export type CampaignPerformanceState =
  | "Strong"
  | "Healthy"
  | "Needs attention"
  | "Underperforming"
  | "Insufficient data";

export type BudgetPacingState =
  | "On track"
  | "Underspending"
  | "Overspending"
  | "Projected overspend"
  | "Unavailable";

export type PaidChannelPerformance = {
  provider: string;
  providerKey: string;
  connected: boolean;
  spend: number | null;
  revenue: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
  budgetUtilisation: number | null;
  activeCampaigns: number;
  spendShare: number | null;
  freshness: DataFreshnessState;
  freshnessLabel: string;
};

export type PaidCampaignPerformance = {
  id: string;
  provider: string;
  name: string;
  status: CampaignStatus;
  objective: string | null;
  spend: number | null;
  budget: number | null;
  revenue: number | null;
  conversions: number | null;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
  startDate: string | null;
  endDate: string | null;
  performanceState: CampaignPerformanceState;
  freshness: DataFreshnessState;
};

export type PaidCreativePerformance = {
  id: string;
  name: string;
  provider: string;
  campaignName: string | null;
  format: string | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  conversions: number | null;
  cpa: number | null;
  roas: number | null;
  frequency: number | null;
  performanceState: CampaignPerformanceState;
  fatigueDetected: boolean;
  fatigueReason: string | null;
};

export type BudgetAllocationItem = {
  provider: string;
  spend: number;
  spendShare: number;
  roas: number | null;
  pacing: BudgetPacingState;
  projectedSpend: number | null;
};

export type PaidAdvertisingWorkspaceData = {
  hasBrandContext: boolean;
  dateRange: {
    label: string;
    comparisonLabel: string;
    from: string;
    to: string;
  };
  freshness: {
    label: string;
    state: DataFreshnessState;
  };
  coverage: string;
  currency: string;
  executiveKpis: MarketingMetric[];
  chart: Record<PaidChartMetric, PaidChartPoint[]>;
  channels: PaidChannelPerformance[];
  budgetAllocation: BudgetAllocationItem[];
  campaigns: PaidCampaignPerformance[];
  creatives: PaidCreativePerformance[];
  insights: import("@/lib/marketing-intelligence/types").MarketingSignal[];
  totals: {
    spend: number;
    previousSpend: number;
    revenue: number;
    previousRevenue: number;
    conversions: number;
    previousConversions: number;
    roas: number | null;
    cpa: number | null;
    budgetUtilisation: number | null;
    activeCampaigns: number;
  };
};
