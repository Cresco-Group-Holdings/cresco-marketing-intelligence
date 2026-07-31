export type AnalysisInput = {
  dateRangeStart: Date;
  dateRangeEnd: Date;
  comparisonPeriodStart: Date | null;
  comparisonPeriodEnd: Date | null;
  provider?: string;
  accountId?: string;
  campaignId?: string;
  currency: string;
  reportingCurrency?: string;
  attributionModel: string;
  comparisonAttributionModel?: string;
  minimumVolume: number;
  metrics: {
    impressions?: number;
    clicks?: number;
    spend?: number;
    conversions?: number;
    revenue?: number;
    comparisonSpend?: number;
    comparisonConversions?: number;
    comparisonCtr?: number;
    benchmarkCpc?: number;
    benchmarkCpa?: number;
    landingPageBounceRate?: number;
    landingPageConversionRate?: number;
  };
  dataQuality: {
    freshnessHours: number | null;
    hasTracking: boolean;
    warnings?: string[];
  };
  budgetPacing?: {
    overspendRisk: boolean;
    remainingBudget: number;
  };
  activeExperiment?: {
    id: string;
    status: string;
    isValid: boolean;
    hasMaterialChangeRisk: boolean;
  };
  recentMaterialChanges?: Array<{ type: string; at: string; description: string }>;
  metricDefinitions?: Record<string, string>;
  campaignStructure?: Record<string, unknown>;
  creativePerformance?: Record<string, unknown>;
  audiencePerformance?: Record<string, unknown>;
  funnelMetrics?: Record<string, unknown>;
  userNotes?: string;
};
