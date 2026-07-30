import type { MarketingDataProvider } from "@prisma/client";

export type PaidAdsAccount = {
  accountId: string;
  name: string;
  currency?: string;
  timezone?: string;
  status?: string;
  metadata?: Record<string, unknown>;
};

export type PaidAdsCampaign = {
  campaignId: string;
  accountId: string;
  name: string;
  status?: string;
  campaignType?: string;
  startDate?: string;
  endDate?: string;
  budgetAmount?: number;
  budgetCurrency?: string;
  metadata?: Record<string, unknown>;
};

export type PaidAdsAdGroup = {
  adGroupId: string;
  campaignId: string;
  name: string;
  status?: string;
  metadata?: Record<string, unknown>;
};

export type PaidAdsAd = {
  adId: string;
  adGroupId: string;
  campaignId?: string;
  name?: string;
  status?: string;
  adType?: string;
  creativeId?: string;
  metadata?: Record<string, unknown>;
};

export type PaidAdsCreative = {
  creativeId: string;
  adId?: string;
  name?: string;
  creativeType?: string;
  status?: string;
  metadata?: Record<string, unknown>;
};

export type PaidAdsMetricsRow = {
  date: string;
  accountId: string;
  campaignId?: string;
  adGroupId?: string;
  adId?: string;
  creativeId?: string;
  metrics: Record<string, number>;
  attributionWindow?: string;
  conversionDefinitions?: Record<string, string>;
  currency?: string;
  metadata?: Record<string, unknown>;
};

export type PaidAdsConversionRow = {
  date: string;
  accountId: string;
  conversionActionId: string;
  conversionActionName: string;
  conversions: number;
  conversionValue?: number;
  attributionWindow?: string;
  metadata?: Record<string, unknown>;
};

export type PaidAdsSpendRow = {
  date: string;
  accountId: string;
  campaignId?: string;
  adGroupId?: string;
  adId?: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
};

export type PaidAdsSyncRecord = {
  recordType:
    | "account"
    | "campaign"
    | "ad_group"
    | "ad"
    | "creative"
    | "metrics_row"
    | "conversion_row"
    | "spend_row";
  provider: MarketingDataProvider;
  payload: Record<string, unknown>;
};

export type PaidAdsConnectorMetadata = {
  adAccountId?: string;
  adAccountName?: string;
  currency?: string;
  timezone?: string;
  attributionWindow?: string;
  syncState?: {
    backfillStartDate?: string;
    lastSyncedDate?: string;
    initialBackfillComplete?: boolean;
    lastReconciliationAt?: string;
  };
};

export type PaidAdsProviderError = {
  code: string;
  message: string;
  retryable: boolean;
  provider: MarketingDataProvider;
};
