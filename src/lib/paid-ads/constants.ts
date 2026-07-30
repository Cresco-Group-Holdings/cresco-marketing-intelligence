import type { ConnectorType, MarketingDataProvider } from "@prisma/client";

export const PAID_ADS_PROVIDERS: MarketingDataProvider[] = [
  "GOOGLE_ADS",
  "META",
  "LINKEDIN",
  "TIKTOK",
];

export const PAID_ADS_CONNECTOR_TYPES: ConnectorType[] = [
  "GOOGLE_ADS",
  "META",
  "LINKEDIN",
  "TIKTOK",
];

export const PAID_ADS_DEFAULT_BACKFILL_DAYS = 90;
export const PAID_ADS_RECONCILIATION_DAYS = 3;
export const PAID_ADS_DATA_DELAY_DAYS = 1;
export const PAID_ADS_TRANSFORMATION_VERSION = "2026-07-30.1";
export const PAID_ADS_MAX_PAGE_SIZE = 1000;

export const PROVIDER_TO_CONNECTOR: Record<string, ConnectorType> = {
  GOOGLE_ADS: "GOOGLE_ADS",
  META: "META",
  LINKEDIN: "LINKEDIN",
  TIKTOK: "TIKTOK",
};

export const CONNECTOR_TO_PROVIDER: Record<ConnectorType, MarketingDataProvider | null> = {
  GOOGLE_ADS: "GOOGLE_ADS",
  META: "META",
  LINKEDIN: "LINKEDIN",
  TIKTOK: "TIKTOK",
  GOOGLE_ANALYTICS_4: null,
  GOOGLE_SEARCH_CONSOLE: null,
  INSTAGRAM: null,
  YOUTUBE: null,
  X: null,
  STRIPE: null,
  EMAIL_PROVIDER: null,
  CRM_PROVIDER: null,
};

export function isPaidAdsProvider(provider: string): provider is MarketingDataProvider {
  return PAID_ADS_PROVIDERS.includes(provider as MarketingDataProvider);
}

export function isPaidAdsConnector(connectorType: ConnectorType): boolean {
  return PAID_ADS_CONNECTOR_TYPES.includes(connectorType);
}
