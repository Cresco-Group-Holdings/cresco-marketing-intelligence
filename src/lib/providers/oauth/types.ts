export type OAuthTokenResult = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  grantedScopes: string[];
  externalAccountId?: string;
  externalLabel?: string;
  tokenType?: string;
};

export type DiscoveredAccount = {
  externalAccountId: string;
  accountType: string;
  displayName: string;
  metadata?: Record<string, unknown>;
};

export type ProviderIdentity = {
  externalAccountId: string;
  displayName: string;
  email?: string;
  metadata?: Record<string, unknown>;
};

export type ProviderOAuthConfigStatus = "READY" | "DISABLED" | "MISCONFIGURED";

export type ProviderOAuthAdapter = {
  readonly providerKey: string;

  getConfigStatus(): ProviderOAuthConfigStatus;

  buildAuthorizationUrl(input: {
    redirectUri: string;
    state: string;
    scopes: string[];
    codeChallenge?: string;
  }): string;

  exchangeAuthorizationCode(input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<OAuthTokenResult>;

  refreshAccessToken(input: { refreshToken: string }): Promise<OAuthTokenResult>;

  revokeToken(input: { accessToken: string }): Promise<void>;

  getIdentity(input: { accessToken: string }): Promise<ProviderIdentity>;

  discoverAccounts(input: { accessToken: string }): Promise<DiscoveredAccount[]>;

  validateConnection(input: { accessToken: string }): Promise<{ healthy: boolean; message?: string }>;
};
