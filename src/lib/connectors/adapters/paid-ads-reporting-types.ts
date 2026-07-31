import type { ConnectorType, MarketingDataProvider } from "@prisma/client";
import type { ConnectorAdapter } from "@/lib/connectors/adapters/types";
import type {
  PaidAdsAccount,
  PaidAdsAd,
  PaidAdsAdGroup,
  PaidAdsCampaign,
  PaidAdsConversionRow,
  PaidAdsCreative,
  PaidAdsMetricsRow,
  PaidAdsProviderError,
  PaidAdsSpendRow,
} from "@/lib/paid-ads/types";

export interface PaidAdsReportingAdapter extends ConnectorAdapter {
  readonly provider: MarketingDataProvider;
  readonly connectorType: ConnectorType;

  listAccounts(accessToken: string): Promise<PaidAdsAccount[]>;
  validateAccount(accessToken: string, accountId: string): Promise<boolean>;
  getCampaigns(accessToken: string, accountId: string): Promise<PaidAdsCampaign[]>;
  getAdGroups(accessToken: string, accountId: string, campaignId: string): Promise<PaidAdsAdGroup[]>;
  getAds(accessToken: string, accountId: string, adGroupId: string): Promise<PaidAdsAd[]>;
  getCreatives(accessToken: string, accountId: string, adId: string): Promise<PaidAdsCreative[]>;
  getMetrics(
    accessToken: string,
    accountId: string,
    startDate: string,
    endDate: string,
    cursor?: string,
  ): Promise<{ rows: PaidAdsMetricsRow[]; nextCursor?: string }>;
  getConversions(
    accessToken: string,
    accountId: string,
    startDate: string,
    endDate: string,
  ): Promise<PaidAdsConversionRow[]>;
  getSpend(
    accessToken: string,
    accountId: string,
    startDate: string,
    endDate: string,
    cursor?: string,
  ): Promise<{ rows: PaidAdsSpendRow[]; nextCursor?: string }>;
  normaliseError(error: unknown): PaidAdsProviderError;
}
