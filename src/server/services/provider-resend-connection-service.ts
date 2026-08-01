import { prisma } from "@/lib/database/prisma";
import { getProviderDefinition, resolveProviderAdapter } from "@/lib/providers/registry";
import { isResendProviderEnabled } from "@/lib/providers/resend-config";
import type { ProviderAdapterContext } from "@/lib/providers/adapter-contracts";
import type { ProviderConfiguration } from "@/lib/providers/types";
import { AppError } from "@/lib/errors";
import { assertProviderConnectorsEnabled } from "@/lib/providers/feature-flags";
import { providerAuditService } from "@/server/services/provider-audit-service";
import { providerConnectionService } from "@/server/services/provider-connection-service";
import { providerCredentialService } from "@/server/services/provider-credential-service";
import { providerHealthService } from "@/server/services/provider-health-service";
import type { TenantContext } from "@/lib/tenancy/context";
import type { ProviderEnvironment } from "@prisma/client";
import { RESEND_API_KEY_PATTERN } from "@/server/providers/resend/resend-types";

export const providerResendConnectionService = {
  async connectWithApiKey(
    context: TenantContext,
    input: {
      displayName: string;
      apiKey: string;
      environment?: ProviderEnvironment;
      brandId?: string;
      projectId?: string;
      defaultSendingDomain?: string;
      defaultSenderIdentity?: string;
      connectionId?: string;
    },
  ) {
    assertProviderConnectorsEnabled();
    if (!isResendProviderEnabled()) {
      throw new AppError("FORBIDDEN", "Resend provider is not enabled.");
    }

    if (!RESEND_API_KEY_PATTERN.test(input.apiKey)) {
      throw new AppError("VALIDATION_ERROR", "Malformed Resend API key.");
    }

    const definition = getProviderDefinition("resend");
    if (!definition) {
      throw new AppError("VALIDATION_ERROR", "Resend provider is not registered.");
    }

    let connectionId = input.connectionId;
    if (!connectionId) {
      const draft = await providerConnectionService.createDraftConnection(context, {
        providerKey: "resend",
        displayName: input.displayName,
        brandId: input.brandId,
        projectId: input.projectId,
        environment: input.environment ?? "PRODUCTION",
        configuration: {
          defaultSendingDomain: input.defaultSendingDomain,
          defaultSenderIdentity: input.defaultSenderIdentity,
          testMode: false,
        },
      });
      connectionId = draft.id;
    }

    const adapter = resolveProviderAdapter("resend");
    if (!adapter || !("validateApiKey" in adapter)) {
      throw new AppError("INTERNAL_ERROR", "Resend adapter unavailable.");
    }

    const validation = await adapter.validateApiKey(input.apiKey);
    if (!validation.success) {
      await providerConnectionService.updateConnectionStatus(context, connectionId, "ERROR", {
        code: validation.errorCode,
        message: validation.message,
      });
      await providerAuditService.recordEvent({
        organisationId: context.organisationId,
        providerKey: "resend",
        action: "CONNECTION_TESTED",
        connectionId,
        actorUserId: context.userId,
        result: "failure",
        errorCode: validation.errorCode,
      });
      throw new AppError("VALIDATION_ERROR", validation.message);
    }

    await providerCredentialService.storeCredential({
      organisationId: context.organisationId,
      connectionId,
      credentialType: "API_KEY",
      plaintext: input.apiKey,
    });

    const testResult = await adapter.testConnection({
      organisationId: context.organisationId,
      connectionId,
      providerKey: "resend",
      configuration: {
        defaultSendingDomain: input.defaultSendingDomain,
        defaultSenderIdentity: input.defaultSenderIdentity,
      } as ProviderConfiguration,
      correlationId: undefined,
    });

    const domains = "listVerifiedDomains" in adapter
      ? await (adapter as { listVerifiedDomains: (ctx: ProviderAdapterContext) => Promise<Array<{ sendingEligible: boolean }>> }).listVerifiedDomains({
          organisationId: context.organisationId,
          connectionId,
          providerKey: "resend",
          configuration: {},
        })
      : [];

    await prisma.providerConnection.update({
      where: { id: connectionId },
      data: {
        status: "CONNECTED",
        connectedAt: new Date(),
        lastSuccessfulAt: new Date(),
        lastHealthCheckAt: new Date(),
        configuration: {
          defaultSendingDomain: input.defaultSendingDomain,
          defaultSenderIdentity: input.defaultSenderIdentity,
          domainCount: Array.isArray(domains) ? domains.length : 0,
        },
      },
    });

    await providerHealthService.upsertHealth({
      organisationId: context.organisationId,
      connectionId,
      status: "HEALTHY",
      success: true,
      metadata: { domainCount: Array.isArray(domains) ? domains.length : 0 },
    });

    await providerAuditService.recordEvent({
      organisationId: context.organisationId,
      providerKey: "resend",
      action: "CONNECTION_TESTED",
      connectionId,
      actorUserId: context.userId,
      result: "success",
      metadata: { domainCount: Array.isArray(domains) ? domains.length : 0 },
    });

    const credential = await prisma.providerCredential.findFirst({
      where: { connectionId, credentialType: "API_KEY", revokedAt: null },
    });

    return {
      connected: true,
      provider: "resend",
      connectionId,
      domainCount: Array.isArray(domains) ? domains.length : 0,
      verifiedDomainCount: Array.isArray(domains)
        ? domains.filter((d) => d.sendingEligible).length
        : 0,
      health: testResult.success ? "HEALTHY" : "UNHEALTHY",
      fingerprint: credential?.fingerprint ?? null,
    };
  },

  async testConnection(context: TenantContext, connectionId: string) {
    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId: context.organisationId, providerKey: "resend" },
    });
    if (!connection) throw new AppError("NOT_FOUND", "Resend connection not found.");

    const adapter = resolveProviderAdapter("resend");
    if (!adapter || !("testConnection" in adapter)) {
      throw new AppError("INTERNAL_ERROR", "Resend adapter unavailable.");
    }

    const result = await adapter.testConnection({
      organisationId: context.organisationId,
      connectionId,
      providerKey: "resend",
      configuration: (connection.configuration ?? {}) as ProviderConfiguration,
      correlationId: undefined,
    });

    const status = result.success ? "CONNECTED" : "REAUTH_REQUIRED";
    await providerConnectionService.updateConnectionStatus(
      context,
      connectionId,
      result.success ? "CONNECTED" : "REAUTH_REQUIRED",
      result.success ? undefined : { code: result.errorCode, message: result.message },
    );

    await providerHealthService.upsertHealth({
      organisationId: context.organisationId,
      connectionId,
      status: result.success ? "HEALTHY" : "UNHEALTHY",
      success: result.success,
      errorCode: result.errorCode,
      errorMessage: result.message,
    });

    await providerAuditService.recordEvent({
      organisationId: context.organisationId,
      providerKey: "resend",
      action: "CONNECTION_TESTED",
      connectionId,
      actorUserId: context.userId,
      result: result.success ? "success" : "failure",
      errorCode: result.errorCode,
    });

    const domains = "listVerifiedDomains" in adapter
      ? await (adapter as { listVerifiedDomains: (ctx: ProviderAdapterContext) => Promise<Array<{ sendingEligible: boolean }>> }).listVerifiedDomains({
          organisationId: context.organisationId,
          connectionId,
          providerKey: "resend",
          configuration: (connection.configuration ?? {}) as ProviderConfiguration,
        })
      : [];

    return {
      connected: result.success,
      provider: "resend",
      domainCount: domains.length,
      verifiedDomainCount: domains.filter((d) => d.sendingEligible).length,
      health: result.success ? "HEALTHY" : "UNHEALTHY",
      safeErrorCode: result.errorCode,
    };
  },

  async listDomains(context: TenantContext, connectionId: string) {
    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId: context.organisationId, providerKey: "resend" },
    });
    if (!connection) throw new AppError("NOT_FOUND", "Resend connection not found.");

    const adapter = resolveProviderAdapter("resend");
    if (!adapter || !("listVerifiedDomains" in adapter)) {
      throw new AppError("INTERNAL_ERROR", "Resend adapter unavailable.");
    }

    const domains = await (adapter as { listVerifiedDomains: (ctx: ProviderAdapterContext) => Promise<unknown[]> }).listVerifiedDomains({
      organisationId: context.organisationId,
      connectionId,
      providerKey: "resend",
      configuration: (connection.configuration ?? {}) as ProviderConfiguration,
      correlationId: undefined,
    });

    await prisma.providerConnection.update({
      where: { id: connectionId },
      data: {
        lastHealthCheckAt: new Date(),
        configuration: {
          ...(connection.configuration as object),
          domainsLastCheckedAt: new Date().toISOString(),
          domainCount: domains.length,
        },
      },
    });

    return domains;
  },

  async revokeConnection(context: TenantContext, connectionId: string) {
    await providerCredentialService.revokeAllCredentials(connectionId);
    await providerConnectionService.disconnectConnection(context, connectionId);
    await providerAuditService.recordEvent({
      organisationId: context.organisationId,
      providerKey: "resend",
      action: "CREDENTIAL_REVOKED",
      connectionId,
      actorUserId: context.userId,
      result: "success",
    });
  },
};
