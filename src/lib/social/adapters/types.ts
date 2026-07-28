import type { SocialProvider } from "@prisma/client";
import type {
  SocialOAuthTokenPair,
  SocialProviderAccountSummary,
  SocialProviderError,
  SocialProviderProfile,
} from "@/lib/social/types";

export type SocialAuthorisationInput = {
  redirectUri: string;
  state: string;
  scopes: string[];
  codeChallenge?: string;
};

export type SocialCodeExchangeInput = {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
};

export type SocialTokenRefreshInput = {
  refreshToken: string;
};

export type SocialConnectionValidationInput = {
  accessToken: string;
  grantedScopes: string[];
};

export interface SocialProviderAdapter {
  readonly provider: SocialProvider;
  getAuthorisationUrl(input: SocialAuthorisationInput): Promise<string> | string;
  exchangeAuthorisationCode(input: SocialCodeExchangeInput): Promise<SocialOAuthTokenPair>;
  refreshAccessToken(input: SocialTokenRefreshInput): Promise<SocialOAuthTokenPair>;
  revokeConnection(accessToken: string, refreshToken?: string): Promise<void>;
  getGrantedScopes(tokens: SocialOAuthTokenPair): string[];
  getAvailableAccounts(accessToken: string): Promise<SocialProviderAccountSummary[]>;
  getAccountProfile(
    accessToken: string,
    providerAccountId: string,
  ): Promise<SocialProviderProfile>;
  validateConnection(input: SocialConnectionValidationInput): Promise<boolean>;
  normaliseProviderError(error: unknown): SocialProviderError;
}

export interface SocialProviderAdapterFactory {
  getAdapter(provider: SocialProvider): SocialProviderAdapter | null;
  register(adapter: SocialProviderAdapter): void;
  reset(): void;
}
