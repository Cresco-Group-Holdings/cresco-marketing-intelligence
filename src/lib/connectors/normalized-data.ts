/**
 * Canonical marketing data concepts for the normalised data layer.
 * Provider-specific identifiers and raw payloads remain in connector metadata.
 */

export type NormalisedChannel = {
  id: string;
  provider: string;
  providerChannelId: string;
  name: string;
  type: string;
  /** Provider-specific channel configuration */
  providerMetadata?: Record<string, unknown>;
};

export type NormalisedAccount = {
  id: string;
  provider: string;
  providerAccountId: string;
  name: string;
  currency?: string;
  timezone?: string;
  providerMetadata?: Record<string, unknown>;
};

export type NormalisedCampaign = {
  id: string;
  provider: string;
  providerCampaignId: string;
  accountId: string;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
  providerMetadata?: Record<string, unknown>;
};

export type NormalisedContentItem = {
  id: string;
  provider: string;
  providerContentId: string;
  channelId?: string;
  title?: string;
  contentType: string;
  publishedAt?: string;
  url?: string;
  providerMetadata?: Record<string, unknown>;
};

export type NormalisedAudience = {
  id: string;
  provider: string;
  providerAudienceId: string;
  name: string;
  size?: number;
  providerMetadata?: Record<string, unknown>;
};

export type NormalisedEvent = {
  id: string;
  provider: string;
  providerEventId: string;
  eventName: string;
  occurredAt: string;
  properties?: Record<string, unknown>;
  providerMetadata?: Record<string, unknown>;
};

export type NormalisedConversion = {
  id: string;
  provider: string;
  providerConversionId: string;
  eventId?: string;
  value?: number;
  currency?: string;
  convertedAt: string;
  providerMetadata?: Record<string, unknown>;
};

export type NormalisedLead = {
  id: string;
  provider: string;
  providerLeadId: string;
  email?: string;
  source?: string;
  capturedAt: string;
  providerMetadata?: Record<string, unknown>;
};

export type NormalisedSpend = {
  id: string;
  provider: string;
  providerSpendId: string;
  campaignId?: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  providerMetadata?: Record<string, unknown>;
};

export type NormalisedRevenue = {
  id: string;
  provider: string;
  providerRevenueId: string;
  amount: number;
  currency: string;
  recognisedAt: string;
  providerMetadata?: Record<string, unknown>;
};

export type NormalisedMetricObservation = {
  id: string;
  provider: string;
  metricKey: string;
  value: number;
  unit?: string;
  dimensions?: Record<string, string>;
  observedAt: string;
  providerMetadata?: Record<string, unknown>;
};

/**
 * Fields that remain provider-specific and are not normalised:
 * - Raw API payloads
 * - Provider-native status enums
 * - Attribution models
 * - Platform-specific creative/asset references
 * - Internal provider hierarchy IDs beyond the mapped canonical IDs
 */
