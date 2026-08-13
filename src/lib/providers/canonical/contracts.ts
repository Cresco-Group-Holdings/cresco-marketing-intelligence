export type CanonicalExternalAccount = {
  externalId: string;
  providerKey: string;
  displayName: string;
  accountType?: string;
  currency?: string;
  timezone?: string;
  status?: string;
};

export type CanonicalExternalCampaign = {
  externalId: string;
  providerKey: string;
  providerAccountId: string;
  name: string;
  status: string;
  objective?: string;
  startDate?: string;
  endDate?: string;
  dailyBudget?: number;
  totalBudget?: number;
  currency?: string;
  sourceUpdatedAt?: string;
};

export type CanonicalAnalyticsMetric = {
  externalId: string;
  providerKey: string;
  metricName: string;
  value: number;
  date: string;
  dimensions?: Record<string, string>;
};

export type CanonicalCrmContact = {
  externalId: string;
  providerKey: string;
  displayName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  sourceUpdatedAt?: string;
};

export type CanonicalCrmCompany = {
  externalId: string;
  providerKey: string;
  name: string;
  domain?: string;
  sourceUpdatedAt?: string;
};

export type CanonicalSocialAccount = {
  externalId: string;
  providerKey: string;
  displayName: string;
  platform: string;
};

export type CanonicalSocialPost = {
  externalId: string;
  providerKey: string;
  accountId: string;
  content: string;
  status: string;
  publishedAt?: string;
};

export type CanonicalEmailCampaign = {
  externalId: string;
  providerKey: string;
  name: string;
  status: string;
  sentCount?: number;
};
