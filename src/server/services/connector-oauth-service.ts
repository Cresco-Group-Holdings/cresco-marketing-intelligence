import type { ConnectorType } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { connectorRegistry } from "@/lib/connectors/registry";
import {
  generateOAuthState,
  generatePkceChallenge,
  generatePkceVerifier,
  getOAuthStateExpiry,
  inspectGrantedScopes,
} from "@/lib/connectors/oauth/utils";
import { connectorAdapterFactory } from "@/lib/connectors/adapters/fake-connector-adapter";
import "@/lib/connectors/adapters/register-adapters";
import { buildGoogleOAuthAuthorisationUrl } from "@/lib/connectors/oauth/google";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { getServerEnv } from "@/lib/environment";

export const connectorOAuthService = {
  async beginConnection(input: {
    organisationId: string;
    projectId: string;
    brandId: string;
    connectorType: ConnectorType;
    usePkce?: boolean;
  }) {
    const definition = connectorRegistry.get(input.connectorType);
    if (!connectorRegistry.isConnectable(input.connectorType)) {
      throw new AppError(
        "VALIDATION_ERROR",
        connectorRegistry.getConnectDisabledReason(input.connectorType) ??
          "Connector is not available.",
      );
    }

    const adapter = connectorAdapterFactory.getAdapter(input.connectorType);
    if (!adapter) {
      throw new AppError("VALIDATION_ERROR", "Connector adapter is not registered.");
    }

    const state = generateOAuthState();
    const codeVerifier = input.usePkce ? generatePkceVerifier() : undefined;
    const redirectUri = `${getServerEnv().APP_URL}/api/connectors/oauth/callback`;

    await prisma.connectorOAuthState.create({
      data: {
        organisationId: input.organisationId,
        projectId: input.projectId,
        brandId: input.brandId,
        connectorType: input.connectorType,
        state,
        codeVerifier,
        scopes: definition.requiredScopes,
        redirectUri,
        expiresAt: getOAuthStateExpiry(),
      },
    });

    return {
      state,
      redirectUri,
      scopes: definition.requiredScopes,
      codeChallenge: codeVerifier ? generatePkceChallenge(codeVerifier) : undefined,
      authorisationUrl:
        input.connectorType === "GOOGLE_ANALYTICS_4" ||
        input.connectorType === "GOOGLE_SEARCH_CONSOLE"
          ? buildGoogleOAuthAuthorisationUrl({
              state,
              redirectUri,
              scopes: definition.requiredScopes,
              codeChallenge: codeVerifier ? generatePkceChallenge(codeVerifier) : undefined,
            })
          : `${redirectUri}?state=${state}&connectorType=${input.connectorType}`,
    };
  },

  async validateState(state: string) {
    const record = await prisma.connectorOAuthState.findUnique({ where: { state } });
    if (!record) {
      throw new AppError("VALIDATION_ERROR", "Invalid OAuth state.");
    }
    if (record.expiresAt < new Date()) {
      await prisma.connectorOAuthState.delete({ where: { id: record.id } });
      throw new AppError("VALIDATION_ERROR", "OAuth state has expired.");
    }
    return record;
  },

  async handleCallback(input: {
    state: string;
    code: string;
    connectorAccountId: string;
  }) {
    const oauthState = await this.validateState(input.state);
    const adapter = connectorAdapterFactory.getAdapter(oauthState.connectorType);
    if (!adapter) {
      throw new AppError("VALIDATION_ERROR", "Connector adapter is not registered.");
    }

    const tokens = await adapter.exchangeCode({
      code: input.code,
      redirectUri: oauthState.redirectUri,
      codeVerifier: oauthState.codeVerifier ?? undefined,
    });

    const scopeInspection = inspectGrantedScopes(
      tokens.scopes,
      oauthState.scopes,
      connectorRegistry.get(oauthState.connectorType).optionalScopes,
    );
    if (!scopeInspection.isSufficient) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Missing required scopes: ${scopeInspection.missingRequired.join(", ")}`,
      );
    }

    await connectorCredentialService.upsertTokens(input.connectorAccountId, tokens);
    await prisma.connectorOAuthState.delete({ where: { id: oauthState.id } });

    return {
      connectorType: oauthState.connectorType,
      scopes: tokens.scopes,
      expiresAt: tokens.expiresAt,
    };
  },

  async refreshConnection(connectorAccountId: string, connectorType: ConnectorType) {
    const adapter = connectorAdapterFactory.getAdapter(connectorType);
    if (!adapter) {
      throw new AppError("VALIDATION_ERROR", "Connector adapter is not registered.");
    }

    const tokens = await connectorCredentialService.readTokens(connectorAccountId);
    if (!tokens?.refreshToken) {
      throw new AppError("VALIDATION_ERROR", "Refresh token is not available.");
    }

    const refreshed = await adapter.refreshTokens(tokens.refreshToken);
    await connectorCredentialService.upsertTokens(connectorAccountId, refreshed);
    return refreshed;
  },

  async revokeConnection(connectorAccountId: string, connectorType: ConnectorType) {
    const adapter = connectorAdapterFactory.getAdapter(connectorType);
    if (!adapter) {
      return;
    }

    const tokens = await connectorCredentialService.readTokens(connectorAccountId);
    if (tokens?.accessToken) {
      await adapter.revokeTokens(tokens.accessToken, tokens.refreshToken);
    }
  },
};
