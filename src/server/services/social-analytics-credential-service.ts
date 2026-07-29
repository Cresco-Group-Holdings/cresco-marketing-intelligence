import type { SocialProvider } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { incrementAnalyticsCounter } from "@/lib/analytics/observability";
import { linkedInCredentialAdapter } from "@/lib/social/linkedin-credential-adapter";
import { metaCredentialAdapter } from "@/lib/social/meta-credential-adapter";
import { tikTokCredentialAdapter } from "@/lib/social/tiktok-credential-adapter";
import {
  xCredentialAdapter,
  youtubeCredentialAdapter,
} from "@/lib/social/youtube-x-credential-adapters";
import {
  socialCredentialService,
  type StoredSocialTokens,
} from "@/server/services/social-credential-service";

export type AnalyticsRefreshOutcome =
  | { status: "REFRESHED"; tokens: StoredSocialTokens }
  | { status: "RECONNECT_REQUIRED"; reason: string };

/**
 * Meta extends long-lived tokens with the stored access token; the other providers use a standard
 * refresh grant and therefore need a stored refresh token to be recoverable at all.
 */
const REFRESH_REQUIRES_REFRESH_TOKEN: Record<SocialProvider, boolean> = {
  INSTAGRAM: false,
  FACEBOOK: false,
  LINKEDIN: true,
  TIKTOK: true,
  YOUTUBE: true,
  X: true,
};

async function refreshWithProviderAdapter(
  provider: SocialProvider,
  tokens: StoredSocialTokens,
) {
  switch (provider) {
    case "INSTAGRAM":
    case "FACEBOOK":
      return metaCredentialAdapter.refreshAccessToken({ accessToken: tokens.accessToken });
    case "LINKEDIN":
      return linkedInCredentialAdapter.refreshAccessToken(tokens.refreshToken ?? "");
    case "TIKTOK":
      return tikTokCredentialAdapter.refreshAccessToken({
        refreshToken: tokens.refreshToken ?? "",
      });
    case "YOUTUBE":
      return youtubeCredentialAdapter.refreshAccessToken(tokens.refreshToken ?? "");
    case "X":
      return xCredentialAdapter.refreshAccessToken(tokens.refreshToken ?? "");
  }
}

export const socialAnalyticsCredentialService = {
  /**
   * Marks the connection as needing operator intervention. Analytics stops retrying against a
   * credential the platform cannot repair on its own.
   */
  async markReconnectRequired(input: {
    socialConnectionId: string;
    organisationId: string;
    brandId: string;
    reason: string;
  }) {
    await prisma.socialConnection.updateMany({
      where: {
        id: input.socialConnectionId,
        organisationId: input.organisationId,
        brandId: input.brandId,
      },
      data: {
        status: "REAUTH_REQUIRED",
        reconnectRequiredAt: new Date(),
      },
    });
    incrementAnalyticsCounter("analytics.reconnect_required", 1, {
      socialConnectionId: input.socialConnectionId,
      organisationId: input.organisationId,
      brandId: input.brandId,
      reason: input.reason,
    });
  },

  /**
   * Refreshes an expired analytics credential through the production provider adapter and stores
   * the result. Tenant scope is verified against the connection row before anything is written.
   */
  async refreshForAnalytics(input: {
    provider: SocialProvider;
    socialConnectionId: string;
    organisationId: string;
    brandId: string;
    tokens: StoredSocialTokens;
  }): Promise<AnalyticsRefreshOutcome> {
    const connection = await prisma.socialConnection.findFirst({
      where: {
        id: input.socialConnectionId,
        organisationId: input.organisationId,
        brandId: input.brandId,
        provider: input.provider,
      },
    });
    if (!connection) {
      return {
        status: "RECONNECT_REQUIRED",
        reason: "The social connection is outside the analytics tenant scope.",
      };
    }

    if (REFRESH_REQUIRES_REFRESH_TOKEN[input.provider] && !input.tokens.refreshToken) {
      const reason = `${input.provider} analytics credentials cannot be refreshed without a stored refresh token. Reconnect the account.`;
      await this.markReconnectRequired({ ...input, reason });
      return { status: "RECONNECT_REQUIRED", reason };
    }

    incrementAnalyticsCounter("analytics.refresh_attempts", 1, {
      provider: input.provider,
      organisationId: input.organisationId,
      brandId: input.brandId,
    });

    try {
      const refreshed = await refreshWithProviderAdapter(input.provider, input.tokens);
      await socialCredentialService.upsertTokens(input.socialConnectionId, {
        ...refreshed,
        refreshToken: refreshed.refreshToken ?? input.tokens.refreshToken,
      });
      await prisma.socialConnection.update({
        where: { id: input.socialConnectionId },
        data: {
          status: "CONNECTED",
          lastRefreshAt: new Date(),
          tokenExpiresAt: refreshed.expiresAt ?? null,
          reconnectRequiredAt: null,
        },
      });
      incrementAnalyticsCounter("analytics.refresh_succeeded", 1, {
        provider: input.provider,
        organisationId: input.organisationId,
      });
      return {
        status: "REFRESHED",
        tokens: {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken ?? input.tokens.refreshToken,
        },
      };
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : `${input.provider} analytics credentials could not be refreshed.`;
      incrementAnalyticsCounter("analytics.refresh_failed", 1, {
        provider: input.provider,
        organisationId: input.organisationId,
      });
      await this.markReconnectRequired({ ...input, reason });
      return { status: "RECONNECT_REQUIRED", reason };
    }
  },
};
