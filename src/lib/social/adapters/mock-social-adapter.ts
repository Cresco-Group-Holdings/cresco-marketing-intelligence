import type { SocialAccountType, SocialProvider } from "@prisma/client";
import type { SocialProviderAdapter } from "@/lib/social/adapters/types";
import type {
  SocialOAuthTokenPair,
  SocialProviderAccountSummary,
  SocialProviderError,
} from "@/lib/social/types";

const DEFAULT_SCOPES: Record<SocialProvider, string[]> = {
  INSTAGRAM: ["instagram_basic", "instagram_content_publish", "pages_show_list"],
  FACEBOOK: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"],
  LINKEDIN: ["r_organization_social", "w_organization_social"],
  TIKTOK: ["user.info.basic", "video.upload"],
  YOUTUBE: ["https://www.googleapis.com/auth/youtube"],
  X: ["tweet.read", "tweet.write", "users.read", "offline.access"],
};

const ACCOUNT_TYPES: Record<SocialProvider, SocialAccountType[]> = {
  INSTAGRAM: ["INSTAGRAM_BUSINESS"],
  FACEBOOK: ["FACEBOOK_PAGE"],
  LINKEDIN: ["LINKEDIN_ORGANISATION", "LINKEDIN_MEMBER"],
  TIKTOK: ["TIKTOK_BUSINESS"],
  YOUTUBE: ["YOUTUBE_CHANNEL"],
  X: ["X_ACCOUNT"],
};

export class MockSocialProviderAdapter implements SocialProviderAdapter {
  readonly provider: SocialProvider;
  private readonly accountCount: number;

  constructor(provider: SocialProvider, accountCount = 2) {
    this.provider = provider;
    this.accountCount = accountCount;
  }

  getAuthorisationUrl(input: { redirectUri: string; state: string }): string {
    const url = new URL(input.redirectUri);
    url.searchParams.set("state", input.state);
    url.searchParams.set("provider", this.provider);
    url.searchParams.set("code", `mock-code-${this.provider.toLowerCase()}`);
    return url.toString();
  }

  async exchangeAuthorisationCode(): Promise<SocialOAuthTokenPair> {
    return {
      accessToken: `mock-access-${this.provider.toLowerCase()}`,
      refreshToken: `mock-refresh-${this.provider.toLowerCase()}`,
      expiresAt: new Date(Date.now() + 3_600_000),
      scopes: DEFAULT_SCOPES[this.provider],
    };
  }

  async refreshAccessToken(input: { refreshToken: string }): Promise<SocialOAuthTokenPair> {
    if (!input.refreshToken) {
      throw new Error("Refresh token is required.");
    }
    return {
      accessToken: `mock-refreshed-${this.provider.toLowerCase()}`,
      refreshToken: input.refreshToken,
      expiresAt: new Date(Date.now() + 3_600_000),
      scopes: DEFAULT_SCOPES[this.provider],
    };
  }

  async revokeConnection(): Promise<void> {
    return;
  }

  getGrantedScopes(tokens: SocialOAuthTokenPair): string[] {
    return tokens.scopes;
  }

  async getAvailableAccounts(): Promise<SocialProviderAccountSummary[]> {
    const types = ACCOUNT_TYPES[this.provider];
    return Array.from({ length: this.accountCount }, (_, index) => {
      const accountType = types[index % types.length];
      return {
        providerAccountId: `${this.provider.toLowerCase()}-account-${index + 1}`,
        accountType,
        username: `${this.provider.toLowerCase()}_${index + 1}`,
        displayName: `${this.provider} Account ${index + 1}`,
        profileUrl: `https://example.com/${this.provider.toLowerCase()}/${index + 1}`,
      };
    });
  }

  async getAccountProfile(
    _accessToken: string,
    providerAccountId: string,
  ): Promise<SocialProviderAccountSummary> {
    const accounts = await this.getAvailableAccounts();
    const account = accounts.find((item) => item.providerAccountId === providerAccountId);
    if (!account) {
      throw new Error("Account not found.");
    }
    return account;
  }

  async validateConnection(): Promise<boolean> {
    return true;
  }

  normaliseProviderError(error: unknown): SocialProviderError {
    const message = error instanceof Error ? error.message : "Provider request failed.";
    return {
      code: "PROVIDER_ERROR",
      message,
      retryable: false,
    };
  }
}

class InMemorySocialAdapterFactory {
  private readonly adapters = new Map<SocialProvider, SocialProviderAdapter>();

  register(adapter: SocialProviderAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  getAdapter(provider: SocialProvider): SocialProviderAdapter | null {
    return this.adapters.get(provider) ?? null;
  }

  reset(): void {
    this.adapters.clear();
  }
}

export const socialAdapterFactory = new InMemorySocialAdapterFactory();

export function registerMockSocialAdapter(
  provider: SocialProvider,
  accountCount = 2,
): MockSocialProviderAdapter {
  const adapter = new MockSocialProviderAdapter(provider, accountCount);
  socialAdapterFactory.register(adapter);
  return adapter;
}

export function registerAllMockSocialAdapters(): void {
  const providers: SocialProvider[] = [
    "INSTAGRAM",
    "FACEBOOK",
    "LINKEDIN",
    "TIKTOK",
    "YOUTUBE",
    "X",
  ];
  for (const provider of providers) {
    registerMockSocialAdapter(provider);
  }
}

export function resetSocialAdaptersForTests(): void {
  socialAdapterFactory.reset();
}
