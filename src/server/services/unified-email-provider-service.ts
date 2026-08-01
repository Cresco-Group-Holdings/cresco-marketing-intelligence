import { prisma } from "@/lib/database/prisma";
import type { EmailSendRequest, EmailSendResult } from "@/lib/providers/email-types";
import {
  assertProviderConnectorsEnabled,
  assertProviderLiveCallsEnabled,
  isProviderConnectorsEnabled,
  isProviderLiveCallsEnabled,
} from "@/lib/providers/feature-flags";
import { getProviderDefinition, resolveProviderAdapter } from "@/lib/providers/registry";
import { isEmailEmergencyShutdownEnabled } from "@/lib/providers/resend-config";
import type { ProviderConfiguration } from "@/lib/providers/types";
import { hasPermission } from "@/lib/tenancy/permissions";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { normaliseEmailAddress, shouldBlockSend } from "@/lib/email/suppression";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import type { EmailMessageCategory } from "@prisma/client";

function toEmailCategory(messageType: EmailSendRequest["messageType"]): EmailMessageCategory {
  if (messageType === "MARKETING") return "MARKETING";
  return "ESSENTIAL_TRANSACTIONAL";
}
import { providerAuditService } from "@/server/services/provider-audit-service";
import { providerHealthService } from "@/server/services/provider-health-service";
import { ResendClientError } from "@/server/providers/resend/resend-client";
import { createResendAdapter } from "@/server/providers/resend/resend-adapter";
import { providerCredentialService } from "@/server/services/provider-credential-service";

export type SendGateContext = {
  tenantContext: TenantContext;
  connectionId: string;
  messageType: EmailSendRequest["messageType"];
  approvalId?: string;
  testMode?: boolean;
  requestId?: string;
};

async function assertSendGates(gates: SendGateContext): Promise<void> {
  if (!isProviderConnectorsEnabled()) {
    throw new AppError("FORBIDDEN", "Provider connectors are disabled.");
  }
  if (!gates.testMode) {
    assertProviderLiveCallsEnabled();
  }
  if (isEmailEmergencyShutdownEnabled()) {
    throw new AppError("FORBIDDEN", "Email emergency shutdown is active.");
  }

  const connection = await prisma.providerConnection.findFirst({
    where: {
      id: gates.connectionId,
      organisationId: gates.tenantContext.organisationId,
      providerKey: "resend",
    },
    include: {
      healthStates: true,
    },
  });
  if (!connection) throw new AppError("NOT_FOUND", "Provider connection not found.");
  if (connection.status !== "CONNECTED") {
    throw new AppError("FORBIDDEN", "Provider connection is not connected.");
  }

  const featureFlag = await prisma.providerFeatureFlag.findUnique({
    where: {
      organisationId_providerKey_flagKey: {
        organisationId: gates.tenantContext.organisationId,
        providerKey: "resend",
        flagKey: "live_sending",
      },
    },
  });
  if (!gates.testMode && featureFlag && !featureFlag.enabled) {
    throw new AppError("FORBIDDEN", "Live sending is not enabled for this connection.");
  }

  const permission =
    gates.messageType === "MARKETING"
      ? PERMISSIONS["email.sendMarketing"]
      : gates.messageType === "TEST"
        ? PERMISSIONS["email.sendTest"]
        : PERMISSIONS["email.sendTransactional"];

  if (!hasPermission(gates.tenantContext.organisationRole, permission)) {
    throw new AppError("FORBIDDEN", "Missing email send permission.");
  }

  if (!gates.testMode && gates.messageType !== "TEST" && !gates.approvalId) {
    throw new AppError("FORBIDDEN", "Approved message or campaign is required for live sends.");
  }

  const health = connection.healthStates[0];
  if (health?.circuitState === "OPEN") {
    throw new AppError("FORBIDDEN", "Provider circuit breaker is open.");
  }
}

async function checkRecipientSuppression(
  organisationId: string,
  recipients: string[],
  messageType: EmailSendRequest["messageType"],
): Promise<void> {
  for (const raw of recipients) {
    const emailAddress = normaliseEmailAddress(raw);
    const suppression = await prisma.emailSuppression.findUnique({
      where: { organisationId_emailAddress: { organisationId, emailAddress } },
    });
    const unsubscribe = await prisma.emailUnsubscribe.findFirst({
      where: { organisationId, emailAddress },
    });
    const block = shouldBlockSend(
      toEmailCategory(messageType),
      suppression ? { emailAddress, reason: suppression.reason, suppressed: true } : null,
      !!unsubscribe,
    );
    if (block.blocked) {
      throw new AppError("VALIDATION_ERROR", `Recipient ${emailAddress} is suppressed.`);
    }
  }
}

function getResendAdapter() {
  return createResendAdapter({
    getApiKey: async (context) =>
      providerCredentialService.getCredentialPlaintext(context.connectionId, "API_KEY"),
  }).adapter;
}

export const unifiedEmailProviderService = {
  async sendEmail(
    request: EmailSendRequest,
    gates: SendGateContext,
  ): Promise<EmailSendResult> {
    assertProviderConnectorsEnabled();
    await assertSendGates(gates);
    await checkRecipientSuppression(request.organisationId, request.to, request.messageType);

    const definition = getProviderDefinition("resend");
    if (!definition) throw new AppError("VALIDATION_ERROR", "Resend provider unavailable.");

    const existing = await prisma.providerOutboundSend.findUnique({
      where: {
        organisationId_connectionId_idempotencyKey: {
          organisationId: request.organisationId,
          connectionId: request.connectionId,
          idempotencyKey: request.idempotencyKey,
        },
      },
    });
    if (existing?.providerMessageId) {
      return {
        provider: "resend",
        connectionId: request.connectionId,
        providerMessageId: existing.providerMessageId,
        accepted: true,
        status: "DUPLICATE",
        requestId: existing.requestId ?? undefined,
        sentAt: existing.sentAt?.toISOString(),
      };
    }

    const outbound = await prisma.providerOutboundSend.upsert({
      where: {
        organisationId_connectionId_idempotencyKey: {
          organisationId: request.organisationId,
          connectionId: request.connectionId,
          idempotencyKey: request.idempotencyKey,
        },
      },
      create: {
        organisationId: request.organisationId,
        brandId: request.brandId,
        connectionId: request.connectionId,
        providerKey: "resend",
        idempotencyKey: request.idempotencyKey,
        messageType: request.messageType,
        status: "PENDING",
        approvalId: request.approvalId,
        campaignId: request.campaignId,
        recipientId: request.recipientId,
        requestId: gates.requestId,
      },
      update: {},
    });

    await providerAuditService.recordEvent({
      organisationId: request.organisationId,
      providerKey: "resend",
      action: "EMAIL_SEND_ATTEMPTED",
      connectionId: request.connectionId,
      actorUserId: gates.tenantContext.userId,
      result: "success",
      requestId: gates.requestId,
      metadata: { messageType: request.messageType, testMode: gates.testMode ?? false },
    });

    if (gates.testMode || !isProviderLiveCallsEnabled()) {
      const simulated = await prisma.providerOutboundSend.update({
        where: { id: outbound.id },
        data: { status: "SIMULATED", sentAt: new Date() },
      });
      await providerAuditService.recordEvent({
        organisationId: request.organisationId,
        providerKey: "resend",
        action: "EMAIL_SEND_SIMULATED",
        connectionId: request.connectionId,
        actorUserId: gates.tenantContext.userId,
        result: "success",
      });
      return {
        provider: "resend",
        connectionId: request.connectionId,
        accepted: true,
        status: "SIMULATED",
        requestId: simulated.requestId ?? undefined,
        sentAt: simulated.sentAt?.toISOString(),
      };
    }

    await prisma.providerOutboundSend.update({
      where: { id: outbound.id },
      data: { status: "SUBMITTING" },
    });

    const adapter = resolveProviderAdapter("resend") ?? getResendAdapter();
    if (!adapter || !("sendEmail" in adapter)) {
      throw new AppError("INTERNAL_ERROR", "Email adapter unavailable.");
    }

    try {
      const result = await (
        adapter as {
          sendEmailInternal: (input: {
            context: {
              organisationId: string;
              connectionId: string;
              providerKey: "resend";
              configuration: ProviderConfiguration;
              correlationId?: string;
            };
            message: EmailSendRequest;
            idempotencyKey?: string;
          }) => Promise<EmailSendResult>;
        }
      ).sendEmailInternal({
        context: {
          organisationId: request.organisationId,
          connectionId: request.connectionId,
          providerKey: "resend",
          configuration: {} as ProviderConfiguration,
          correlationId: gates.requestId,
        },
        message: request,
        idempotencyKey: request.idempotencyKey,
      });

      await prisma.providerOutboundSend.update({
        where: { id: outbound.id },
        data: {
          status: result.accepted ? "ACCEPTED" : "FAILED",
          providerMessageId: result.providerMessageId,
          safeErrorCode: result.safeErrorCode,
          sentAt: result.sentAt ? new Date(result.sentAt) : new Date(),
        },
      });

      if (result.accepted) {
        await prisma.providerConnection.update({
          where: { id: request.connectionId },
          data: { lastSuccessfulAt: new Date() },
        });
        await providerHealthService.upsertHealth({
          organisationId: request.organisationId,
          connectionId: request.connectionId,
          status: "HEALTHY",
          success: true,
        });
        await providerAuditService.recordEvent({
          organisationId: request.organisationId,
          providerKey: "resend",
          action: "EMAIL_SEND_ACCEPTED",
          connectionId: request.connectionId,
          actorUserId: gates.tenantContext.userId,
          result: "success",
          metadata: { providerMessageId: result.providerMessageId },
        });
      } else {
        await providerAuditService.recordEvent({
          organisationId: request.organisationId,
          providerKey: "resend",
          action: "EMAIL_SEND_REJECTED",
          connectionId: request.connectionId,
          actorUserId: gates.tenantContext.userId,
          result: "failure",
          errorCode: result.safeErrorCode,
        });
      }

      return result;
    } catch (error) {
      if (error instanceof ResendClientError && error.normalized.code === "RATE_LIMITED") {
        await providerHealthService.recordRateLimit({
          organisationId: request.organisationId,
          connectionId: request.connectionId,
          windowKey: "resend-api",
          retryAfterMs: error.retryAfterMs,
        });
        await providerAuditService.recordEvent({
          organisationId: request.organisationId,
          providerKey: "resend",
          action: "RATE_LIMIT_REACHED",
          connectionId: request.connectionId,
          result: "failure",
        });
      }
      throw error;
    }
  },
};
