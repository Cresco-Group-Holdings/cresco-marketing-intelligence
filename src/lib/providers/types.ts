import type {
  ProviderAuthType,
  ProviderCategory,
  ProviderCapabilityType,
  ProviderConnectionStatus,
  ProviderEnvironment,
  ProviderApiVersionStatus,
} from "@prisma/client";

export type ProviderKey =
  | "meta"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok"
  | "x"
  | "youtube"
  | "pinterest"
  | "google-analytics"
  | "google-search-console"
  | "google-ads"
  | "meta-ads"
  | "linkedin-ads"
  | "tiktok-ads"
  | "microsoft-ads"
  | "resend"
  | "sendgrid"
  | "postmark"
  | "amazon-ses"
  | "smtp"
  | "stripe"
  | "licensed-rank-provider"
  | "csv-import"
  | "first-party-crawler"
  | "mock-advertising"
  | "mock-crm";

export type ProviderDefinition = {
  key: ProviderKey;
  displayName: string;
  category: ProviderCategory;
  authType: ProviderAuthType;
  capabilities: ProviderCapabilityType[];
  supportedEnvironments: ProviderEnvironment[];
  apiVersion: string;
  apiVersionStatus: ProviderApiVersionStatus;
  requiredConfigFields: string[];
  optionalConfigFields: string[];
  webhookSupport: boolean;
  pushSupport: boolean;
  pullSupport: boolean;
  requiresApproval: boolean;
  documentationUrl?: string;
  enabled: boolean;
  oauthScopes?: Record<string, string[]>;
  featureFlags?: Record<string, boolean>;
};

export type ProviderConfiguration = Record<string, unknown>;

export type ProviderConnectionOwnership = {
  organisationId: string;
  projectId?: string | null;
  brandId?: string | null;
  userId?: string | null;
};

export type SafeProviderConnection = {
  id: string;
  providerKey: string;
  displayName: string | null;
  category: ProviderCategory;
  authType: ProviderAuthType;
  environment: ProviderEnvironment;
  status: ProviderConnectionStatus;
  externalLabel: string | null;
  lastHealthCheckAt: string | null;
  lastSuccessfulAt: string | null;
  tokenExpiresAt: string | null;
  reauthorizationRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProviderHealthResult = {
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN";
  message?: string;
  checkedAt: string;
};

export type ProviderTestResult = {
  success: boolean;
  message: string;
  errorCode?: string;
};

export type ProviderRateLimitStatus = {
  limited: boolean;
  retryAfterMs?: number;
  windowKey?: string;
};

export type ProviderRetryClassification = "retryable" | "non_retryable" | "rate_limited";

export type ProviderNormalizedError = {
  code: string;
  message: string;
  retryable: boolean;
  statusCode?: number;
  correlationId?: string;
};
