import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { getProviderDefinition, getRequiredOAuthScopes } from "@/lib/providers/registry";
import { assertProviderConnectorsEnabled } from "@/lib/providers/feature-flags";
import { createSignedOAuthStatePayload } from "@/lib/providers/oauth/state-signing";
import { generateOAuthStateToken, generatePkceChallenge, generatePkceVerifier } from "@/lib/providers/oauth/pkce";
import { isReturnUrlAllowed } from "@/lib/providers/oauth/security";
import { PROVIDER_OAUTH_STATE_TTL_MS } from "@/lib/providers/constants";
import { providerAuditService } from "@/server/services/provider-audit-service";
import { providerConnectionService } from "@/server/services/provider-connection-service";

export const providerOAuthService = {
  async startAuthorization(
    context: TenantContext,
    input: {
      connectionId: string;
      returnUrl?: string;
      redirectUri: string;
    },
  ) {
    assertProviderConnectorsEnabled();

    if (!isReturnUrlAllowed(input.returnUrl)) {
      throw new AppError("VALIDATION_ERROR", "Return URL is not allowed.");
    }

    const connection = await prisma.providerConnection.findFirst({
      where: { id: input.connectionId, organisationId: context.organisationId },
    });
    if (!connection) {
      throw new AppError("NOT_FOUND", "Provider connection not found.");
    }

    const definition = getProviderDefinition(connection.providerKey);
    if (!definition) {
      throw new AppError("VALIDATION_ERROR", "Unknown provider.");
    }

    const state = generateOAuthStateToken();
    const codeVerifier =
      definition.authType === "OAUTH2_PKCE" ? generatePkceVerifier() : undefined;
    const scopes = getRequiredOAuthScopes(connection.providerKey);
    const nonce = generateOAuthStateToken();

    const { signed } = createSignedOAuthStatePayload({
      organisationId: context.organisationId,
      providerKey: connection.providerKey,
      connectionId: connection.id,
      returnUrl: input.returnUrl,
      nonce,
    });

    await prisma.providerOAuthState.create({
      data: {
        organisationId: context.organisationId,
        connectionId: connection.id,
        providerKey: connection.providerKey,
        state,
        codeVerifier,
        nonce,
        scopes,
        redirectUri: input.redirectUri,
        returnUrl: input.returnUrl,
        signedPayload: signed,
        expiresAt: new Date(Date.now() + PROVIDER_OAUTH_STATE_TTL_MS),
      },
    });

    await providerConnectionService.updateConnectionStatus(context, connection.id, "PENDING_AUTHORIZATION");
    await providerAuditService.recordEvent({
      organisationId: context.organisationId,
      providerKey: connection.providerKey,
      action: "AUTHORIZATION_STARTED",
      connectionId: connection.id,
      actorUserId: context.userId,
      result: "success",
    });

    const codeChallenge = codeVerifier ? generatePkceChallenge(codeVerifier) : undefined;
    const authorizeUrl = new URL(`/api/providers/${connection.providerKey}/authorize-stub`, input.redirectUri);
    authorizeUrl.searchParams.set("state", state);
    if (codeChallenge) {
      authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    }

    return {
      state,
      authorizeUrl: authorizeUrl.toString(),
      expiresAt: new Date(Date.now() + PROVIDER_OAUTH_STATE_TTL_MS).toISOString(),
    };
  },

  async consumeOAuthState(state: string) {
    const oauthState = await prisma.providerOAuthState.findUnique({ where: { state } });
    if (!oauthState) {
      throw new AppError("VALIDATION_ERROR", "Invalid OAuth state.");
    }
    if (oauthState.consumedAt) {
      throw new AppError("VALIDATION_ERROR", "OAuth state already consumed.");
    }
    if (oauthState.expiresAt < new Date()) {
      await prisma.providerOAuthState.delete({ where: { id: oauthState.id } });
      throw new AppError("VALIDATION_ERROR", "OAuth state expired.");
    }

    await prisma.providerOAuthState.update({
      where: { id: oauthState.id },
      data: { consumedAt: new Date() },
    });

    return oauthState;
  },
};
