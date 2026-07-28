import type { SocialProvider } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  generateOAuthState,
  generatePkceChallenge,
  generatePkceVerifier,
  getOAuthStateExpiry,
  inspectGrantedScopes,
} from "@/lib/connectors/oauth/utils";
import { getServerEnv } from "@/lib/environment";
import { SOCIAL_OAUTH_CALLBACK_PATH } from "@/lib/social/constants";
import { socialAdapterFactory } from "@/lib/social/adapters/mock-social-adapter";
import { createSocialProviderRegistry } from "@/lib/social/registry";
import { socialCredentialService } from "@/server/services/social-credential-service";

const socialRegistry = createSocialProviderRegistry(
  (provider) => socialAdapterFactory.getAdapter(provider) !== null,
);

export const socialOAuthService = {
  getRedirectUri(): string {
    return `${getServerEnv().APP_URL}${SOCIAL_OAUTH_CALLBACK_PATH}`;
  },

  async beginAuthorisation(input: {
    organisationId: string;
    projectId: string;
    brandId: string;
    userId: string;
    socialConnectionId: string;
    provider: SocialProvider;
  }) {
    if (!socialRegistry.isConnectable(input.provider)) {
      throw new AppError(
        "VALIDATION_ERROR",
        socialRegistry.getConnectDisabledReason(input.provider) ??
          "Provider is not available.",
      );
    }

    const adapter = socialAdapterFactory.getAdapter(input.provider);
    if (!adapter) {
      throw new AppError("VALIDATION_ERROR", "Provider adapter is not registered.");
    }

    const definition = socialRegistry.get(input.provider);
    const state = generateOAuthState();
    const codeVerifier = definition.supportsPkce ? generatePkceVerifier() : undefined;
    const redirectUri = this.getRedirectUri();
    const scopes = [...definition.requiredScopes, ...definition.optionalScopes];

    await prisma.oAuthAuthorisationState.create({
      data: {
        organisationId: input.organisationId,
        projectId: input.projectId,
        brandId: input.brandId,
        userId: input.userId,
        socialConnectionId: input.socialConnectionId,
        provider: input.provider,
        state,
        codeVerifier,
        scopes,
        redirectUri,
        expiresAt: getOAuthStateExpiry(),
      },
    });

    const authorisationUrl = await adapter.getAuthorisationUrl({
      redirectUri,
      state,
      scopes,
      codeChallenge: codeVerifier ? generatePkceChallenge(codeVerifier) : undefined,
    });

    return {
      state,
      redirectUri,
      scopes: definition.requiredScopes,
      authorisationUrl,
    };
  },

  async validateState(state: string, userId: string) {
    const record = await prisma.oAuthAuthorisationState.findUnique({ where: { state } });
    if (!record) {
      throw new AppError("VALIDATION_ERROR", "Invalid OAuth state.");
    }
    if (record.consumedAt) {
      throw new AppError("VALIDATION_ERROR", "OAuth state has already been used.");
    }
    if (record.expiresAt < new Date()) {
      await prisma.oAuthAuthorisationState.delete({ where: { id: record.id } });
      throw new AppError("VALIDATION_ERROR", "OAuth state has expired.");
    }
    if (record.userId !== userId) {
      throw new AppError("FORBIDDEN", "OAuth state does not belong to the current user.");
    }
    return record;
  },

  async handleCallback(input: { state: string; code: string; userId: string }) {
    const oauthState = await this.validateState(input.state, input.userId);
    const adapter = socialAdapterFactory.getAdapter(oauthState.provider);
    if (!adapter) {
      throw new AppError("VALIDATION_ERROR", "Provider adapter is not registered.");
    }

    const redirectUri = this.getRedirectUri();
    if (oauthState.redirectUri !== redirectUri) {
      throw new AppError("VALIDATION_ERROR", "Invalid OAuth callback origin.");
    }

    let tokens;
    try {
      tokens = await adapter.exchangeAuthorisationCode({
        code: input.code,
        redirectUri,
        codeVerifier: oauthState.codeVerifier ?? undefined,
      });
    } catch (error) {
      const normalised = adapter.normaliseProviderError(error);
      throw new AppError("VALIDATION_ERROR", normalised.message);
    }

    const definition = socialRegistry.get(oauthState.provider);
    const scopeInspection = inspectGrantedScopes(
      tokens.scopes,
      definition.requiredScopes,
      definition.optionalScopes,
    );

    const status = scopeInspection.isSufficient ? "CONNECTING" : "PERMISSION_MISSING";

    await socialCredentialService.upsertTokens(oauthState.socialConnectionId, tokens);

    const availableAccounts = await adapter.getAvailableAccounts(tokens.accessToken);

    await prisma.$transaction([
      prisma.socialConnection.update({
        where: { id: oauthState.socialConnectionId },
        data: {
          status,
          grantedScopes: tokens.scopes,
          tokenExpiresAt: tokens.expiresAt,
          lastValidatedAt: new Date(),
          pendingAccounts: availableAccounts as unknown as Prisma.InputJsonValue,
        },
      }),
      prisma.oAuthAuthorisationState.update({
        where: { id: oauthState.id },
        data: { consumedAt: new Date() },
      }),
    ]);

    return {
      socialConnectionId: oauthState.socialConnectionId,
      organisationId: oauthState.organisationId,
      projectId: oauthState.projectId,
      brandId: oauthState.brandId,
      provider: oauthState.provider,
      status,
      missingScopes: scopeInspection.missingRequired,
      pendingAccountCount: availableAccounts.length,
    };
  },

  async refreshConnection(socialConnectionId: string, provider: SocialProvider) {
    const adapter = socialAdapterFactory.getAdapter(provider);
    if (!adapter) {
      throw new AppError("VALIDATION_ERROR", "Provider adapter is not registered.");
    }

    const tokens = await socialCredentialService.readTokens(socialConnectionId);
    if (!tokens?.refreshToken) {
      throw new AppError("VALIDATION_ERROR", "Refresh token is not available.");
    }

    let refreshed;
    try {
      refreshed = await adapter.refreshAccessToken({ refreshToken: tokens.refreshToken });
    } catch (error) {
      const normalised = adapter.normaliseProviderError(error);
      throw new AppError("VALIDATION_ERROR", normalised.message);
    }

    await socialCredentialService.upsertTokens(socialConnectionId, refreshed);
    await prisma.socialConnection.update({
      where: { id: socialConnectionId },
      data: {
        grantedScopes: refreshed.scopes,
        tokenExpiresAt: refreshed.expiresAt,
        lastRefreshAt: new Date(),
        lastValidatedAt: new Date(),
        status: "CONNECTED",
        reconnectRequiredAt: null,
      },
    });

    return refreshed;
  },

  async revokeConnection(socialConnectionId: string, provider: SocialProvider) {
    const adapter = socialAdapterFactory.getAdapter(provider);
    if (!adapter) {
      return;
    }

    const tokens = await socialCredentialService.readTokens(socialConnectionId);
    if (tokens?.accessToken) {
      await adapter.revokeConnection(tokens.accessToken, tokens.refreshToken);
    }
  },
};
