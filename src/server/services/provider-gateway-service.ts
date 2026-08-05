import { prisma } from "@/lib/database/prisma";
import { isCanonicalCapability } from "@/lib/providers/capability-registry";
import { PROVIDER_ERROR_CODES, ProviderGatewayError } from "@/lib/providers/errors";
import type { ProviderOperation, ProviderOperationResult } from "@/lib/providers/platform-adapter";
import { resolvePlatformAdapter } from "@/lib/providers/platform-registry";
import { classifyProviderError, withProviderRetry } from "@/lib/providers/execution-policy";
import { providerCredentialService } from "@/server/services/provider-credential-service";
import { providerAuditService } from "@/server/services/provider-audit-service";
import { providerHealthService } from "@/server/services/provider-health-service";
import type { TenantContext } from "@/lib/tenancy/context";
import type { ProviderCredentialType } from "@prisma/client";
import { AppError } from "@/lib/errors";

export type ProviderGatewayExecuteInput = {
  organisationId: string;
  connectionId: string;
  capability: string;
  operation: string;
  input: unknown;
  idempotencyKey?: string;
  correlationId?: string;
};

const EXECUTABLE_STATUSES = new Set(["CONNECTED", "DEGRADED"]);

export const providerGateway = {
  async execute<TOutput = unknown>(
    input: ProviderGatewayExecuteInput,
    context: TenantContext,
  ): Promise<ProviderOperationResult<TOutput>> {
    if (!isCanonicalCapability(input.capability)) {
      throw new ProviderGatewayError({
        code: PROVIDER_ERROR_CODES.PROVIDER_CAPABILITY_UNSUPPORTED,
        safeMessage: "Unsupported capability.",
        requestId: input.correlationId,
      });
    }

    const connection = await prisma.providerConnection.findFirst({
      where: { id: input.connectionId, organisationId: input.organisationId },
    });
    if (!connection) {
      throw new ProviderGatewayError({
        code: PROVIDER_ERROR_CODES.PROVIDER_CONNECTION_NOT_FOUND,
        safeMessage: "Integration connection not found.",
        requestId: input.correlationId,
      });
    }

    if (connection.revokedAt) {
      throw new ProviderGatewayError({
        code: PROVIDER_ERROR_CODES.PROVIDER_AUTH_FAILED,
        safeMessage: "Connection has been revoked.",
        requestId: input.correlationId,
      });
    }

    if (!EXECUTABLE_STATUSES.has(connection.status)) {
      throw new ProviderGatewayError({
        code: PROVIDER_ERROR_CODES.PROVIDER_ACTION_REQUIRED,
        safeMessage: `Connection is not ready (status: ${connection.status}).`,
        requestId: input.correlationId,
      });
    }

    const adapter = resolvePlatformAdapter({
      providerKey: connection.providerKey,
      apiVersion: connection.providerVersion,
      capability: input.capability,
    });

    const executionContext = {
      organisationId: connection.organisationId,
      connectionId: connection.id,
      providerKey: connection.providerKey,
      apiVersion: connection.providerVersion,
      configuration: (connection.configuration as Record<string, unknown>) ?? {},
      correlationId: input.correlationId ?? crypto.randomUUID(),
      decryptCredential: async (type: string) => {
        try {
          return await providerCredentialService.getCredentialPlaintext(
            connection.id,
            type as ProviderCredentialType,
          );
        } catch {
          return null;
        }
      },
    };

    const operation: ProviderOperation = {
      capability: input.capability,
      operation: input.operation,
      input: input.input,
      idempotencyKey: input.idempotencyKey,
    };

    try {
      const result = await withProviderRetry(
        () => adapter.execute(operation, executionContext),
        { correlationId: executionContext.correlationId },
      );

      if (result.success) {
        await prisma.providerConnection.update({
          where: { id: connection.id },
          data: { lastSuccessfulAt: new Date(), lastErrorAt: null, lastErrorCode: null, lastErrorMessage: null },
        });
      } else if (!result.retryable) {
        await prisma.providerConnection.update({
          where: { id: connection.id },
          data: {
            status: result.errorCode === "PROVIDER_AUTH_FAILED" ? "REAUTH_REQUIRED" : connection.status,
            lastErrorAt: new Date(),
            lastErrorCode: result.errorCode,
            lastErrorMessage: result.errorMessageSafe,
          },
        });
      }

      await providerAuditService.recordEvent({
        organisationId: connection.organisationId,
        providerKey: connection.providerKey,
        connectionId: connection.id,
        action: "CONNECTION_TESTED",
        actorUserId: context.userProfileId,
        requestId: executionContext.correlationId,
        result: result.success ? "success" : "failure",
        metadata: { capability: input.capability, operation: input.operation },
      });

      return result as ProviderOperationResult<TOutput>;
    } catch (error) {
      const classification = classifyProviderError(error);
      await providerHealthService.upsertHealth({
        organisationId: connection.organisationId,
        connectionId: connection.id,
        status: "DEGRADED",
        success: false,
      });

      if (error instanceof ProviderGatewayError) throw error;
      throw new ProviderGatewayError({
        code: PROVIDER_ERROR_CODES.PROVIDER_UNAVAILABLE,
        safeMessage: "Provider operation failed.",
        requestId: executionContext.correlationId,
        retryable: classification === "retryable" || classification === "rate_limited",
        cause: error,
      });
    }
  },

  async verifyConnection(connectionId: string, organisationId: string, context: TenantContext) {
    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId },
    });
    if (!connection) throw new AppError("NOT_FOUND", "Connection not found.");

    const adapter = resolvePlatformAdapter({
      providerKey: connection.providerKey,
      apiVersion: connection.providerVersion,
    });

    const health = await adapter.verifyConnection({
      organisationId,
      connectionId,
      providerKey: connection.providerKey,
      apiVersion: connection.providerVersion,
      configuration: (connection.configuration as Record<string, unknown>) ?? {},
      correlationId: crypto.randomUUID(),
      decryptCredential: async (type) =>
        providerCredentialService
          .getCredentialPlaintext(connectionId, type as ProviderCredentialType)
          .catch(() => null),
    });

    await prisma.providerConnection.update({
      where: { id: connectionId },
      data: { lastHealthCheckAt: new Date() },
    });

    await providerAuditService.recordEvent({
      organisationId,
      providerKey: connection.providerKey,
      connectionId,
      action: "CONNECTION_TESTED",
      actorUserId: context.userProfileId,
      result: health.status === "HEALTHY" ? "success" : "failure",
    });

    return health;
  },
};
