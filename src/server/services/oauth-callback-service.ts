import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { getProviderDefinition } from "@/lib/providers/registry";
import { getOAuthProviderDefinition } from "@/lib/integrations/oauth/provider-definitions";
import {
  buildStateDigest,
  decryptOAuthPayload,
  decryptPkceVerifierReference,
  validateRedirectUri,
} from "@/lib/integrations/oauth/security";
import { verifySignedOAuthStatePayload } from "@/lib/providers/oauth/state-signing";
import { isOAuthMockAllowed, isProductionRuntime } from "@/lib/providers/oauth/runtime";
import { oauthAdapterRegistry } from "@/server/providers/oauth/oauth-adapter-registry";
import { credentialVault } from "@/server/services/credential-vault";
import { connectionScopeResolver } from "@/server/services/connection-scope-resolver";
import { connectionLifecycleService } from "@/server/services/connection-lifecycle-service";
import { providerAccountDiscoveryService } from "@/server/services/provider-account-discovery-service";
import { buildTenantContextForUser } from "@/lib/tenancy/guards";
import { providerAuditService } from "@/server/services/provider-audit-service";

export const oauthCallbackService = {
  async handleCallback(input: {
    providerKey: string;
    code?: string;
    state?: string;
    error?: string;
    errorDescription?: string;
    redirectUri: string;
    mode?: string;
  }) {
    if (input.error) {
      throw new AppError(
        "VALIDATION_ERROR",
        input.errorDescription ?? `OAuth error: ${input.error}`,
      );
    }
    if (!input.state) {
      throw new AppError("VALIDATION_ERROR", "Missing OAuth state.");
    }

    if (input.mode === "mock" && isProductionRuntime() && !isOAuthMockAllowed()) {
      throw new AppError("VALIDATION_ERROR", "Mock OAuth callbacks are not permitted in production.");
    }

    const code =
      input.code ??
      (input.mode === "mock" && isOAuthMockAllowed()
        ? `mock_code_${input.providerKey}_${Date.now()}`
        : undefined);
    if (!code) {
      throw new AppError("VALIDATION_ERROR", "Missing OAuth code.");
    }

    const provider = getProviderDefinition(input.providerKey);
    if (!provider?.capabilities.includes("OAUTH_CONNECT")) {
      throw new AppError("NOT_FOUND", "Provider not found or OAuth not supported.");
    }

    const oauthDef = getOAuthProviderDefinition(input.providerKey);
    if (!oauthDef) {
      throw new AppError("VALIDATION_ERROR", "OAuth configuration not available.");
    }

    const stateDigest = buildStateDigest(input.state);
    const transaction = await prisma.oAuthTransaction.findUnique({
      where: { stateDigest },
    });

    if (!transaction) {
      throw new AppError("VALIDATION_ERROR", "Invalid or unknown OAuth state.");
    }
    if (transaction.providerKey !== input.providerKey) {
      throw new AppError("VALIDATION_ERROR", "Provider mismatch.");
    }
    if (transaction.consumedAt) {
      throw new AppError("VALIDATION_ERROR", "OAuth transaction already consumed.");
    }
    if (transaction.expiresAt.getTime() < Date.now()) {
      throw new AppError("VALIDATION_ERROR", "OAuth transaction expired.");
    }

    validateRedirectUri(input.redirectUri, transaction.redirectUri);

    const payload = decryptOAuthPayload(transaction.encryptedState);
    if (payload.stateToken !== input.state) {
      throw new AppError("VALIDATION_ERROR", "State token mismatch.");
    }

    const verified = verifySignedOAuthStatePayload(payload.signedState);
    if (
      verified.organisationId !== transaction.organisationId ||
      verified.connectionId !== transaction.connectionId ||
      verified.providerKey !== transaction.providerKey
    ) {
      throw new AppError("VALIDATION_ERROR", "OAuth state verification failed.");
    }

    if (oauthDef.usesPkce) {
      const codeVerifier = decryptPkceVerifierReference(transaction.codeVerifierReference);
      if (!codeVerifier) {
        throw new AppError("VALIDATION_ERROR", "PKCE verifier unavailable.");
      }
    }

    const tokenResponse = await oauthAdapterRegistry.exchangeAuthorizationCode({
      providerKey: input.providerKey,
      code,
      redirectUri: transaction.redirectUri,
      codeVerifier: decryptPkceVerifierReference(transaction.codeVerifierReference) ?? undefined,
    });

    const validation = await oauthAdapterRegistry.validateConnection({
      providerKey: input.providerKey,
      accessToken: tokenResponse.accessToken,
    });
    if (!validation.healthy) {
      throw new AppError(
        "AUTH_PROVIDER_UNAVAILABLE",
        validation.message ?? "Provider connection verification failed.",
      );
    }

    const connectionId = transaction.connectionId!;
    const grantedScopes = tokenResponse.grantedScopes;

    await credentialVault.store({
      organisationId: transaction.organisationId,
      connectionId,
      credentialType: "OAUTH_ACCESS_TOKEN",
      plaintext: tokenResponse.accessToken,
      expiresAt: tokenResponse.expiresAt,
      actorUserId: transaction.initiatedByUserId,
      providerKey: input.providerKey,
    });

    if (tokenResponse.refreshToken) {
      await credentialVault.store({
        organisationId: transaction.organisationId,
        connectionId,
        credentialType: "OAUTH_REFRESH_TOKEN",
        plaintext: tokenResponse.refreshToken,
        actorUserId: transaction.initiatedByUserId,
        providerKey: input.providerKey,
      });
    }

    await connectionScopeResolver.upsertScopeRecord({
      organisationId: transaction.organisationId,
      connectionId,
      requestedScopes: transaction.requestedScopes,
      grantedScopes,
      optionalScopes: oauthDef.optionalScopes,
    });

    const missingScopes = connectionScopeResolver.computeMissingScopes(
      transaction.requestedScopes,
      grantedScopes,
    );

    const initiator = await prisma.userProfile.findUnique({
      where: { id: transaction.initiatedByUserId },
      select: { id: true, authUserId: true },
    });
    if (!initiator) {
      throw new AppError("VALIDATION_ERROR", "OAuth initiator not found.");
    }

    const tenantContext = await buildTenantContextForUser(initiator.id, {
      organisationId: transaction.organisationId,
      authUserId: initiator.authUserId,
    });

    const nextStatus = missingScopes.length > 0 ? "ACTION_REQUIRED" : "CONNECTED";
    await connectionLifecycleService.transition(tenantContext, connectionId, nextStatus);

    await prisma.providerConnection.update({
      where: { id: connectionId },
      data: {
        externalAccountId: tokenResponse.externalAccountId ?? undefined,
        externalLabel: tokenResponse.externalLabel ?? undefined,
        grantedScopes,
        tokenExpiresAt: tokenResponse.expiresAt,
        lastHealthCheckAt: new Date(),
        lastSuccessfulAt: new Date(),
      },
    });

    await providerAccountDiscoveryService.discoverAndStoreAccounts({
      organisationId: transaction.organisationId,
      connectionId,
      providerKey: input.providerKey,
      accessToken: tokenResponse.accessToken,
    });

    await prisma.oAuthTransaction.update({
      where: { id: transaction.id },
      data: { consumedAt: new Date() },
    });

    await providerAuditService.recordEvent({
      organisationId: transaction.organisationId,
      providerKey: input.providerKey,
      action: "AUTHORIZATION_COMPLETED",
      connectionId,
      actorUserId: transaction.initiatedByUserId,
      result: "success",
      metadata: { missingScopes },
    });

    return {
      connectionId,
      organisationId: transaction.organisationId,
      returnPath: transaction.returnPath ?? "/integrations",
      grantedScopes,
      missingScopes,
      status: nextStatus,
    };
  },
};
