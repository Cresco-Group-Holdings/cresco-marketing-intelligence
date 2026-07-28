import type { SocialAccountType, SocialCapability, SocialProvider } from "@prisma/client";

export type SocialOAuthTokenPair = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
};

export type SocialProviderAccountSummary = {
  providerAccountId: string;
  accountType: SocialAccountType;
  username?: string;
  displayName?: string;
  profileUrl?: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
};

export type SocialProviderProfile = SocialProviderAccountSummary;

export type SocialProviderError = {
  code: string;
  message: string;
  retryable: boolean;
  statusCode?: number;
};

export type SocialProviderCatalogueItem = {
  provider: SocialProvider;
  name: string;
  description: string;
  requiredScopes: string[];
  optionalScopes: string[];
  maturity: "available" | "beta" | "not_configured" | "unavailable";
  maturityReason: string | null;
  supportsPkce: boolean;
  documentationUrl?: string;
};

export type PublicSocialConnection = {
  id: string;
  provider: SocialProvider;
  status: string;
  grantedScopes: string[];
  connectedByUserId: string | null;
  tokenExpiresAt: string | null;
  lastValidatedAt: string | null;
  lastRefreshAt: string | null;
  reconnectRequiredAt: string | null;
  disconnectedAt: string | null;
  missingScopes: string[];
  account: PublicSocialAccount | null;
};

export type PublicSocialAccount = {
  id: string;
  provider: SocialProvider;
  providerAccountId: string;
  accountType: SocialAccountType;
  username: string | null;
  displayName: string | null;
  profileUrl: string | null;
  avatarUrl: string | null;
  status: string;
  capabilities: SocialCapability[];
};

export type PendingSocialAccount = {
  providerAccountId: string;
  accountType: SocialAccountType;
  username?: string;
  displayName?: string;
  profileUrl?: string;
  avatarUrl?: string;
};
