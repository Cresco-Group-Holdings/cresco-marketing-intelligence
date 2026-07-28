import type { SocialProvider } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { detectCapabilities, getMissingScopes } from "@/lib/social/capabilities";
import { socialAdapterFactory } from "@/lib/social/adapters/mock-social-adapter";
import { createSocialProviderRegistry } from "@/lib/social/registry";
import type {
  PendingSocialAccount,
  PublicSocialAccount,
  PublicSocialConnection,
} from "@/lib/social/types";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";
import { socialCredentialService } from "@/server/services/social-credential-service";
import { socialOAuthService } from "@/server/services/social-oauth-service";

const socialRegistry = createSocialProviderRegistry(
  (provider) => socialAdapterFactory.getAdapter(provider) !== null,
);

type BrandScope = {
  organisationId: string;
  projectId: string;
  brandId: string;
};

async function resolveBrandScope(
  brandId: string,
  organisationId: string,
  context: TenantContext,
): Promise<BrandScope> {
  const brand = await brandService.getById(brandId, organisationId, context);
  return {
    organisationId,
    projectId: brand.projectId,
    brandId,
  };
}

function toPublicAccount(account: {
  id: string;
  provider: SocialProvider;
  providerAccountId: string;
  accountType: import("@prisma/client").SocialAccountType;
  username: string | null;
  displayName: string | null;
  profileUrl: string | null;
  avatarUrl: string | null;
  status: import("@prisma/client").SocialConnectionStatus;
  capabilities: Array<{ capability: import("@prisma/client").SocialCapability }>;
}): PublicSocialAccount {
  return {
    id: account.id,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    accountType: account.accountType,
    username: account.username,
    displayName: account.displayName,
    profileUrl: account.profileUrl,
    avatarUrl: account.avatarUrl,
    status: account.status,
    capabilities: account.capabilities.map((item) => item.capability),
  };
}

function toPublicConnection(
  connection: {
    id: string;
    provider: SocialProvider;
    status: import("@prisma/client").SocialConnectionStatus;
    grantedScopes: string[];
    connectedByUserId: string | null;
    tokenExpiresAt: Date | null;
    lastValidatedAt: Date | null;
    lastRefreshAt: Date | null;
    reconnectRequiredAt: Date | null;
    disconnectedAt: Date | null;
    accounts: Array<{
      id: string;
      provider: SocialProvider;
      providerAccountId: string;
      accountType: import("@prisma/client").SocialAccountType;
      username: string | null;
      displayName: string | null;
      profileUrl: string | null;
      avatarUrl: string | null;
      status: import("@prisma/client").SocialConnectionStatus;
      capabilities: Array<{ capability: import("@prisma/client").SocialCapability }>;
    }>;
  },
  requiredScopes: string[],
): PublicSocialConnection {
  const assignedAccount = connection.accounts[0] ?? null;
  return {
    id: connection.id,
    provider: connection.provider,
    status: connection.status,
    grantedScopes: connection.grantedScopes,
    connectedByUserId: connection.connectedByUserId,
    tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
    lastValidatedAt: connection.lastValidatedAt?.toISOString() ?? null,
    lastRefreshAt: connection.lastRefreshAt?.toISOString() ?? null,
    reconnectRequiredAt: connection.reconnectRequiredAt?.toISOString() ?? null,
    disconnectedAt: connection.disconnectedAt?.toISOString() ?? null,
    missingScopes: getMissingScopes(requiredScopes, connection.grantedScopes),
    account: assignedAccount ? toPublicAccount(assignedAccount) : null,
  };
}

export const socialConnectionService = {
  async getCatalogue(
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const connections = await prisma.socialConnection.findMany({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
      },
      include: {
        accounts: {
          include: { capabilities: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });

    const connectionByProvider = new Map(
      connections.map((connection) => [connection.provider, connection]),
    );

    return socialRegistry.list().map((provider) => {
      const connection = connectionByProvider.get(provider.provider);
      return {
        ...provider,
        connection: connection
          ? toPublicConnection(connection, provider.requiredScopes)
          : null,
        canConnect: socialRegistry.isConnectable(provider.provider),
        connectDisabledReason: socialRegistry.getConnectDisabledReason(provider.provider),
      };
    });
  },

  async getConnectionDetail(
    brandId: string,
    organisationId: string,
    connectionId: string,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const connection = await prisma.socialConnection.findFirst({
      where: {
        id: connectionId,
        organisationId: scope.organisationId,
        brandId: scope.brandId,
      },
      include: {
        accounts: {
          include: { capabilities: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });

    if (!connection) {
      throw new AppError("NOT_FOUND", "Social connection was not found.");
    }

    const provider = socialRegistry.get(connection.provider);
    return {
      ...provider,
      connection: toPublicConnection(connection, provider.requiredScopes),
    };
  },

  async beginConnect(
    brandId: string,
    organisationId: string,
    provider: SocialProvider,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);

    if (!socialRegistry.isConnectable(provider)) {
      throw new AppError(
        "VALIDATION_ERROR",
        socialRegistry.getConnectDisabledReason(provider) ?? "Provider is not available.",
      );
    }

    const connection = await prisma.socialConnection.upsert({
      where: {
        brandId_provider: {
          brandId: scope.brandId,
          provider,
        },
      },
      create: {
        organisationId: scope.organisationId,
        projectId: scope.projectId,
        brandId: scope.brandId,
        provider,
        status: "CONNECTING",
        connectedByUserId: context.userProfileId,
      },
      update: {
        status: "CONNECTING",
        connectedByUserId: context.userProfileId,
        disconnectedAt: null,
        pendingAccounts: Prisma.JsonNull,
      },
    });

    const oauth = await socialOAuthService.beginAuthorisation({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      brandId: scope.brandId,
      userId: context.userProfileId,
      socialConnectionId: connection.id,
      provider,
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "social.connectionStarted",
      resourceType: "socialConnection",
      resourceId: connection.id,
      requestId,
      metadata: { provider },
    });

    return {
      connectionId: connection.id,
      provider,
      authorisationUrl: oauth.authorisationUrl,
      requiredScopes: oauth.scopes,
    };
  },

  async getPendingAccounts(
    brandId: string,
    organisationId: string,
    connectionId: string,
    context: TenantContext,
  ): Promise<PendingSocialAccount[]> {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const connection = await prisma.socialConnection.findFirst({
      where: {
        id: connectionId,
        organisationId: scope.organisationId,
        brandId: scope.brandId,
      },
    });

    if (!connection) {
      throw new AppError("NOT_FOUND", "Social connection was not found.");
    }

    if (!connection.pendingAccounts) {
      return [];
    }

    return connection.pendingAccounts as PendingSocialAccount[];
  },

  async assignAccount(
    brandId: string,
    organisationId: string,
    connectionId: string,
    providerAccountId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const connection = await prisma.socialConnection.findFirst({
      where: {
        id: connectionId,
        organisationId: scope.organisationId,
        brandId: scope.brandId,
      },
    });

    if (!connection) {
      throw new AppError("NOT_FOUND", "Social connection was not found.");
    }

    const pendingAccounts = (connection.pendingAccounts ?? []) as PendingSocialAccount[];
    const selected = pendingAccounts.find(
      (account) => account.providerAccountId === providerAccountId,
    );

    if (!selected) {
      throw new AppError("VALIDATION_ERROR", "Selected account is not available for assignment.");
    }

    const tokens = await socialCredentialService.readTokens(connection.id);
    if (!tokens) {
      throw new AppError("VALIDATION_ERROR", "Connection credentials are not available.");
    }

    const adapter = socialAdapterFactory.getAdapter(connection.provider);
    if (!adapter) {
      throw new AppError("VALIDATION_ERROR", "Provider adapter is not registered.");
    }

    const profile = await adapter.getAccountProfile(tokens.accessToken, providerAccountId);
    const capabilities = detectCapabilities(profile.accountType, connection.grantedScopes);

    const account = await prisma.$transaction(async (tx) => {
      await tx.socialAccount.deleteMany({
        where: { socialConnectionId: connection.id },
      });

      const created = await tx.socialAccount.create({
        data: {
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          socialConnectionId: connection.id,
          provider: connection.provider,
          providerAccountId: profile.providerAccountId,
          accountType: profile.accountType,
          username: profile.username,
          displayName: profile.displayName,
          profileUrl: profile.profileUrl,
          avatarUrl: profile.avatarUrl,
          status: "CONNECTED",
          metadata: profile.metadata ? (profile.metadata as Prisma.InputJsonValue) : undefined,
          capabilities: {
            create: capabilities.map((capability) => ({ capability })),
          },
        },
        include: { capabilities: true },
      });

      await tx.socialConnection.update({
        where: { id: connection.id },
        data: {
          status: connection.status === "PERMISSION_MISSING" ? "PERMISSION_MISSING" : "CONNECTED",
          pendingAccounts: Prisma.JsonNull,
          lastValidatedAt: new Date(),
        },
      });

      return created;
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "social.accountAssigned",
      resourceType: "socialAccount",
      resourceId: account.id,
      requestId,
      metadata: {
        provider: connection.provider,
        providerAccountId: account.providerAccountId,
        accountType: account.accountType,
        capabilityCount: capabilities.length,
      },
    });

    return toPublicAccount({
      ...account,
      capabilities: account.capabilities,
    });
  },

  async reconnect(
    brandId: string,
    organisationId: string,
    connectionId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const connection = await assertConnectionAccess(connectionId, scope);

    await socialOAuthService.refreshConnection(connection.id, connection.provider);

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "social.connectionReauthorised",
      resourceType: "socialConnection",
      resourceId: connection.id,
      requestId,
      metadata: { provider: connection.provider },
    });

    return this.getConnectionDetail(brandId, organisationId, connectionId, context);
  },

  async disconnect(
    brandId: string,
    organisationId: string,
    connectionId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const connection = await assertConnectionAccess(connectionId, scope);

    await socialOAuthService.revokeConnection(connection.id, connection.provider);
    await socialCredentialService.deleteCredentials(connection.id);

    await prisma.$transaction([
      prisma.socialAccount.deleteMany({ where: { socialConnectionId: connection.id } }),
      prisma.socialConnection.update({
        where: { id: connection.id },
        data: {
          status: "DISCONNECTED",
          disconnectedAt: new Date(),
          grantedScopes: [],
          tokenExpiresAt: null,
          pendingAccounts: Prisma.JsonNull,
          reconnectRequiredAt: null,
        },
      }),
    ]);

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "social.connectionDisconnected",
      resourceType: "socialConnection",
      resourceId: connection.id,
      requestId,
      metadata: { provider: connection.provider },
    });
  },

  async recordConnectionFailed(input: {
    connectionId: string;
    organisationId: string;
    projectId: string;
    actorUserId: string;
    provider: SocialProvider;
    reason: string;
    requestId?: string;
  }) {
    await prisma.socialConnection.update({
      where: { id: input.connectionId },
      data: { status: "ERROR" },
    });

    await recordAuditEvent({
      organisationId: input.organisationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: "social.connectionFailed",
      resourceType: "socialConnection",
      resourceId: input.connectionId,
      requestId: input.requestId,
      metadata: { provider: input.provider, reason: input.reason },
    });
  },

  async recordConnectionCompleted(input: {
    connectionId: string;
    organisationId: string;
    projectId: string;
    actorUserId: string;
    provider: SocialProvider;
    requestId?: string;
  }) {
    await recordAuditEvent({
      organisationId: input.organisationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: "social.connectionCompleted",
      resourceType: "socialConnection",
      resourceId: input.connectionId,
      requestId: input.requestId,
      metadata: { provider: input.provider },
    });
  },
};

async function assertConnectionAccess(connectionId: string, scope: BrandScope) {
  const connection = await prisma.socialConnection.findFirst({
    where: {
      id: connectionId,
      organisationId: scope.organisationId,
      brandId: scope.brandId,
    },
  });

  if (!connection) {
    throw new AppError("NOT_FOUND", "Social connection was not found.");
  }

  return connection;
}
