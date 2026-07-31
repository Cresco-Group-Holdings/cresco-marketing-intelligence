import type {
  ProviderConfiguration,
  ProviderHealthResult,
  ProviderKey,
  ProviderRateLimitStatus,
  ProviderTestResult,
} from "@/lib/providers/types";
import type { ProviderCapabilityType } from "@prisma/client";

export type ProviderAdapterContext = {
  organisationId: string;
  connectionId: string;
  providerKey: ProviderKey;
  configuration: ProviderConfiguration;
  correlationId?: string;
};

export interface ProviderAdapter {
  readonly providerKey: ProviderKey;
  validateConfiguration(configuration: ProviderConfiguration): { valid: boolean; errors: string[] };
  testConnection(context: ProviderAdapterContext): Promise<ProviderTestResult>;
  getCapabilities(): ProviderCapabilityType[];
  getHealth(context: ProviderAdapterContext): Promise<ProviderHealthResult>;
  getRateLimitStatus?(context: ProviderAdapterContext): Promise<ProviderRateLimitStatus>;
}

export interface OAuthProviderAdapter extends ProviderAdapter {
  createAuthorizationUrl(input: {
    context: ProviderAdapterContext;
    redirectUri: string;
    state: string;
    codeChallenge?: string;
    scopes: string[];
  }): Promise<{ url: string }>;
  exchangeAuthorizationCode(input: {
    context: ProviderAdapterContext;
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    grantedScopes: string[];
    externalAccountId?: string;
    externalLabel?: string;
  }>;
  refreshAccessToken(input: {
    context: ProviderAdapterContext;
    refreshToken: string;
  }): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }>;
  revokeConnection(context: ProviderAdapterContext): Promise<void>;
}

export interface ApiKeyProviderAdapter extends ProviderAdapter {
  validateApiKey(apiKey: string): Promise<ProviderTestResult>;
}

export interface WebhookProviderAdapter {
  readonly providerKey: ProviderKey;
  verifyWebhookSignature(input: {
    rawBody: string;
    headers: Record<string, string | undefined>;
    secret: string;
  }): boolean;
  extractEventId(payload: unknown): string | null;
  extractEventType(payload: unknown): string | null;
  normalizeWebhookEvent(payload: unknown): Record<string, unknown>;
}

export interface PullProviderAdapter extends ProviderAdapter {
  pull(input: {
    context: ProviderAdapterContext;
    resourceType: string;
    cursor?: string;
  }): Promise<{ records: unknown[]; nextCursor?: string }>;
}

export interface PushProviderAdapter extends ProviderAdapter {
  push(input: {
    context: ProviderAdapterContext;
    resourceType: string;
    payload: unknown;
    idempotencyKey?: string;
  }): Promise<{ externalId?: string }>;
}

export interface AnalyticsProviderAdapter extends PullProviderAdapter {
  pullMetrics(input: {
    context: ProviderAdapterContext;
    dateRange: { start: string; end: string };
    metrics: string[];
  }): Promise<unknown[]>;
}

export interface PublishingProviderAdapter extends PushProviderAdapter {
  publishContent(input: {
    context: ProviderAdapterContext;
    content: unknown;
    idempotencyKey?: string;
  }): Promise<{ externalId: string; url?: string }>;
}

export interface AdvertisingProviderAdapter extends ProviderAdapter {
  getCampaigns(context: ProviderAdapterContext): Promise<unknown[]>;
}

export interface EmailProviderAdapter extends ProviderAdapter {
  sendEmail(input: {
    context: ProviderAdapterContext;
    message: unknown;
    idempotencyKey?: string;
  }): Promise<{ messageId: string }>;
}

export interface PaymentProviderAdapter extends PullProviderAdapter {
  syncTransactions(context: ProviderAdapterContext): Promise<unknown[]>;
}

export interface SearchProviderAdapter extends PullProviderAdapter {
  fetchRankings(input: {
    context: ProviderAdapterContext;
    keywords: string[];
  }): Promise<unknown[]>;
}

export type ProviderAdapterUnion =
  | ProviderAdapter
  | OAuthProviderAdapter
  | ApiKeyProviderAdapter
  | WebhookProviderAdapter
  | PullProviderAdapter
  | PushProviderAdapter;

export function isOAuthProviderAdapter(adapter: ProviderAdapter): adapter is OAuthProviderAdapter {
  return (
    "createAuthorizationUrl" in adapter &&
    "exchangeAuthorizationCode" in adapter &&
    typeof (adapter as OAuthProviderAdapter).createAuthorizationUrl === "function"
  );
}

export function isWebhookProviderAdapter(adapter: unknown): adapter is WebhookProviderAdapter {
  return (
    typeof adapter === "object" &&
    adapter !== null &&
    "verifyWebhookSignature" in adapter &&
    typeof (adapter as WebhookProviderAdapter).verifyWebhookSignature === "function"
  );
}
