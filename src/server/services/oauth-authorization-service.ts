import { randomBytes } from "crypto";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { getProviderDefinition } from "@/lib/providers/registry";
import { getOAuthProviderDefinition } from "@/lib/integrations/oauth/provider-definitions";
import { isStage12OAuthProvider } from "@/lib/integrations/oauth/provider-definitions";
import { OAUTH_TRANSACTION_TTL_MS } from "@/lib/integrations/oauth/constants";
import {
  buildStateDigest,
  encryptOAuthPayload,
  encryptPkceVerifierReference,
  resolveOAuthCallbackUrl,
  validateReturnPath,
} from "@/lib/integrations/oauth/security";
import { generatePkceChallenge, generatePkceVerifier } from "@/lib/providers/oauth/pkce";
import { createSignedOAuthStatePayload } from "@/lib/providers/oauth/state-signing";
import { assertProviderConnectorsEnabled } from "@/lib/providers/feature-flags";
import { oauthAdapterRegistry } from "@/server/providers/oauth/oauth-adapter-registry";
import { providerConnectionService } from "@/server/services/provider-connection-service";
import { connectionScopeResolver } from "@/server/services/connection-scope-resolver";
import { connectionLifecycleService } from "@/server/services/connection-lifecycle-service";
import { providerAuditService } from "@/server/services/provider-audit-service";

export const oauthAuthorizationService = {
  async startConnect(
    context: TenantContext,
    input: {
      providerKey: string;
      returnPath?: string;
      requestedScopes?: string[];
      connectionId?: string;
    },
  ) {
    assertProviderConnectorsEnabled();

    const provider = getProviderDefinition(input.providerKey);
    if (!provider) {
      throw new AppError("NOT_FOUND", "Provider not found.");
    }
    if (!provider.capabilities.includes("OAUTH_CONNECT")) {
      throw new AppError("VALIDATION_ERROR", "Provider does not support OAuth.");
    }
    if (!isStage12OAuthProvider(input.providerKey)) {
      throw new AppError("VALIDATION_ERROR", "OAuth connect is not enabled for this provider.");
    }

    const oauthDef = getOAuthProviderDefinition(input.providerKey);
    if (!oauthDef) {
      throw new AppError("VALIDATION_ERROR", "OAuth configuration not available for provider.");
    }

    const returnPath = (() => {
      try {
        return validateReturnPath(input.returnPath);
      } catch (error) {
        throw new AppError(
          "VALIDATION_ERROR",
          error instanceof Error ? error.message : "Invalid return path.",
        );
      }
    })();
    const requestedScopes = connectionScopeResolver.resolveRequestedScopes(
      input.providerKey,
      input.requestedScopes,
    );

    let connectionId = input.connectionId;
    if (connectionId) {
      const existing = await providerConnectionService.getConnection(context, connectionId);
      if (existing.providerKey !== input.providerKey) {
        throw new AppError("VALIDATION_ERROR", "Connection provider mismatch.");
      }
      const row = await prisma.providerConnection.findFirst({
        where: { id: connectionId, organisationId: context.organisationId },
        select: { status: true },
      });
      if (row && !["PENDING_AUTHORIZATION", "REAUTH_REQUIRED", "EXPIRED", "ACTION_REQUIRED"].includes(row.status)) {
        if (row.status === "DRAFT" || row.status === "PENDING") {
          await connectionLifecycleService.transition(context, connectionId, "PENDING_AUTHORIZATION");
        } else if (["CONNECTED", "DEGRADED", "RECONNECTED"].includes(row.status)) {
          await connectionLifecycleService.transition(context, connectionId, "REAUTH_REQUIRED");
          await connectionLifecycleService.transition(context, connectionId, "PENDING_AUTHORIZATION");
        }
      }
    } else {
      const connection = await providerConnectionService.createDraftConnection(context, {
        providerKey: input.providerKey,
        displayName: provider.displayName,
      });
      connectionId = connection.id;
      await connectionLifecycleService.transition(context, connectionId, "PENDING");
      await connectionLifecycleService.transition(context, connectionId, "PENDING_AUTHORIZATION");
    }

    const codeVerifier = oauthDef.usesPkce ? generatePkceVerifier() : undefined;
    const stateToken = randomBytes(24).toString("hex");
    const stateDigest = buildStateDigest(stateToken);
    const expiresAt = new Date(Date.now() + OAUTH_TRANSACTION_TTL_MS);
    const redirectUri = resolveOAuthCallbackUrl(input.providerKey);

    const { signed } = createSignedOAuthStatePayload({
      organisationId: context.organisationId,
      providerKey: input.providerKey,
      connectionId,
      returnUrl: returnPath,
      nonce: stateToken,
    });

    const encryptedState = encryptOAuthPayload({
      stateToken,
      signedState: signed,
      organisationId: context.organisationId,
      userId: context.userId,
      providerKey: input.providerKey,
      connectionId,
    });

    const codeVerifierReference = codeVerifier
      ? encryptPkceVerifierReference(codeVerifier)
      : undefined;

    await prisma.oAuthTransaction.create({
      data: {
        workspaceId: context.organisationId,
        organisationId: context.organisationId,
        providerKey: input.providerKey,
        connectionId,
        initiatedByUserId: context.userId,
        encryptedState,
        stateDigest,
        codeVerifierReference,
        requestedScopes,
        returnPath,
        redirectUri,
        expiresAt,
      },
    });

    await connectionScopeResolver.upsertScopeRecord({
      organisationId: context.organisationId,
      connectionId,
      requestedScopes,
      grantedScopes: [],
      optionalScopes: oauthDef.optionalScopes,
    });

    const authorizeUrl = oauthAdapterRegistry.buildAuthorizationUrl({
      providerKey: input.providerKey,
      redirectUri,
      state: stateToken,
      codeChallenge: codeVerifier ? generatePkceChallenge(codeVerifier) : undefined,
      scopes: requestedScopes,
    });

    await providerAuditService.recordEvent({
      organisationId: context.organisationId,
      providerKey: input.providerKey,
      action: "AUTHORIZATION_STARTED",
      connectionId,
      actorUserId: context.userId,
      result: "success",
    });

    return {
      connectionId,
      authorizeUrl,
      expiresAt: expiresAt.toISOString(),
      requestedScopes,
      returnPath,
    };
  },
};
