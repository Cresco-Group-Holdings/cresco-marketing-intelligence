import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { operationToCapability } from "@/lib/publishing/outbound-operations";
import { canRetryPublication } from "@/lib/publishing/publication-governance";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { notificationEventService } from "@/server/services/notification-event-service";
import { providerGateway } from "@/server/services/provider-gateway-service";
import { providerAuditService } from "@/server/services/provider-audit-service";

const MAX_ATTEMPTS = 3;

function mapOperationToGatewayOperation(operationType: string): string {
  if (operationType.startsWith("SOCIAL_")) {
    if (operationType === "SOCIAL_CANCEL_SCHEDULED") return "cancelScheduledPost";
    if (operationType === "SOCIAL_GET_STATUS") return "getPublicationStatus";
    if (operationType === "SOCIAL_SCHEDULE_POST") return "schedulePost";
    return "publishPost";
  }
  if (operationType === "AD_CREATE_DRAFT_CAMPAIGN") return "createDraftCampaign";
  if (operationType === "AD_CREATE_AD_GROUP") return "createAdGroup";
  if (operationType === "AD_CREATE_AD_DRAFT") return "createAdDraft";
  if (operationType === "AD_UPLOAD_CREATIVE") return "uploadCreative";
  if (operationType === "AD_PAUSE") return "pauseCampaign";
  if (operationType === "AD_RESUME") return "resumeCampaign";
  if (operationType === "AD_UPDATE_BUDGET") return "updateBudget";
  if (operationType === "EMAIL_SCHEDULE") return "scheduleCampaign";
  if (operationType === "EMAIL_CANCEL") return "cancelCampaign";
  if (operationType === "EMAIL_GET_STATUS") return "getSendStatus";
  if (operationType === "CALENDAR_CREATE_EVENT") return "createEvent";
  if (operationType === "CALENDAR_UPDATE_EVENT") return "updateEvent";
  return "execute";
}

export const publicationExecutionService = {
  async validate(publicationId: string, organisationId: string, brandId: string, context: TenantContext) {
    const publication = await prisma.publication.findFirst({
      where: { id: publicationId, organisationId, brandId },
    });
    if (!publication) throw new AppError("NOT_FOUND", "Publication not found.");
    return publication.validationResult;
  },

  async execute(
    publicationId: string,
    organisationId: string,
    brandId: string,
    context: TenantContext,
    options?: { dryRun?: boolean; requestId?: string },
  ) {
    const publication = await prisma.publication.findFirst({
      where: { id: publicationId, organisationId, brandId },
      include: { budgetChanges: true },
    });
    if (!publication) throw new AppError("NOT_FOUND", "Publication not found.");

    const executableStatuses = new Set(["APPROVED", "SCHEDULED", "QUEUED"]);
    if (!executableStatuses.has(publication.status) && !options?.dryRun) {
      throw new AppError("VALIDATION_ERROR", `Publication cannot be executed in status ${publication.status}.`);
    }

    if (publication.operationType === "AD_UPDATE_BUDGET" && publication.budgetChanges.length === 0) {
      throw new AppError("VALIDATION_ERROR", "Budget change record is required.");
    }

    const attemptNumber =
      (await prisma.publicationAttempt.count({ where: { publicationId } })) + 1;

    if (attemptNumber > MAX_ATTEMPTS && !options?.dryRun) {
      await prisma.publication.update({
        where: { id: publicationId },
        data: { status: "FAILED", lastErrorCode: "MAX_ATTEMPTS_EXCEEDED" },
      });
      throw new AppError("VALIDATION_ERROR", "Maximum execution attempts exceeded.");
    }

    const attempt = await prisma.publicationAttempt.create({
      data: {
        publicationId,
        attemptNumber,
        status: "RUNNING",
        dryRun: options?.dryRun ?? publication.dryRun,
        requestId: options?.requestId ?? crypto.randomUUID(),
        startedAt: new Date(),
      },
    });

    if (!options?.dryRun) {
      await prisma.publication.update({
        where: { id: publicationId },
        data: { status: "PUBLISHING" },
      });
    }

    const capability = operationToCapability(publication.operationType);
    const gatewayOperation = mapOperationToGatewayOperation(publication.operationType);

    try {
      const result = await providerGateway.execute(
        {
          organisationId,
          connectionId: publication.connectionId,
          capability,
          operation: gatewayOperation,
          input: {
            ...(publication.providerPayload as Record<string, unknown> | null),
            externalAccountId: publication.externalAccountId,
            destinationId: publication.destinationId,
            scheduledFor: publication.scheduledFor?.toISOString(),
            timezone: publication.timezone,
            dryRun: options?.dryRun ?? publication.dryRun,
          },
          idempotencyKey: publication.idempotencyKey,
          correlationId: attempt.requestId ?? undefined,
        },
        context,
      );

      if (!result.success) {
        await prisma.publicationAttempt.update({
          where: { id: attempt.id },
          data: {
            status: result.retryable ? "UNKNOWN" : "FAILED",
            errorCode: result.errorCode,
            errorMessageSafe: result.errorMessageSafe,
            completedAt: new Date(),
          },
        });

        await prisma.publication.update({
          where: { id: publicationId },
          data: {
            status: result.retryable ? "QUEUED" : "FAILED",
            lastErrorCode: result.errorCode ?? "PUBLICATION_FAILED",
            lastErrorMessage: result.errorMessageSafe,
          },
        });

        if (!options?.dryRun && !result.retryable) {
          await notificationEventService
            .publicationFailed({
              organisationId,
              brandId,
              publicationId,
              safeError: result.errorMessageSafe ?? "Publication failed.",
              recipientUserIds: [context.userProfileId],
              idempotencyKey: `pub-failed:${publication.idempotencyKey}`,
            })
            .catch(() => undefined);
        }

        throw new AppError("VALIDATION_ERROR", result.errorMessageSafe ?? "Publication failed.");
      }

      const data = result.data as Record<string, unknown> | undefined;
      const externalId = data?.externalPublicationId ? String(data.externalPublicationId) : undefined;
      const permalink = data?.permalink ? String(data.permalink) : undefined;

      await prisma.publicationAttempt.update({
        where: { id: attempt.id },
        data: {
          status: options?.dryRun ? "SUCCEEDED" : "SUCCEEDED",
          providerResponse: data as object,
          completedAt: new Date(),
        },
      });

      if (!options?.dryRun) {
        await prisma.publication.update({
          where: { id: publicationId },
          data: {
            status: publication.scheduledFor && publication.scheduledFor > new Date() ? "SCHEDULED" : "PUBLISHED",
            externalPublicationId: externalId,
            providerPermalink: permalink,
            publishedAt: publication.scheduledFor && publication.scheduledFor > new Date() ? null : new Date(),
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        });
      }

      await providerAuditService.recordEvent({
        organisationId,
        providerKey: publication.providerKey,
        connectionId: publication.connectionId,
        action: "SYNC_COMPLETED",
        actorUserId: context.userProfileId,
        requestId: attempt.requestId ?? undefined,
        result: "success",
        metadata: { publicationId, operation: gatewayOperation, dryRun: options?.dryRun },
      });

      await recordAuditEvent({
        organisationId,
        actorUserId: context.userProfileId,
        action: options?.dryRun ? "publication.validated" : "publication.executed",
        resourceType: "publication",
        resourceId: publicationId,
        requestId: options?.requestId,
        metadata: { externalPublicationId: externalId },
      });

      if (!options?.dryRun) {
        await notificationEventService.publicationSucceeded({
          organisationId,
          brandId,
          publicationId,
          recipientUserIds: [context.userProfileId],
          idempotencyKey: `pub-success:${publication.idempotencyKey}`,
        });
      }

      return { success: true, data, attemptId: attempt.id, dryRun: options?.dryRun };
    } catch (error) {
      if (error instanceof AppError) throw error;

      await prisma.publicationAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "UNKNOWN",
          errorCode: "PROVIDER_UNAVAILABLE",
          errorMessageSafe: "Provider outcome unknown — reconciliation required.",
          completedAt: new Date(),
        },
      });

      await prisma.publication.update({
        where: { id: publicationId },
        data: {
          status: "PARTIALLY_PUBLISHED",
          lastErrorCode: "UNKNOWN_OUTCOME",
          lastErrorMessage: "Provider outcome could not be confirmed.",
        },
      });

      throw new AppError("VALIDATION_ERROR", "Provider outcome unknown.");
    }
  },

  async retry(publicationId: string, organisationId: string, brandId: string, context: TenantContext, requestId?: string) {
    const publication = await prisma.publication.findFirst({
      where: { id: publicationId, organisationId, brandId },
    });
    if (!publication) throw new AppError("NOT_FOUND", "Publication not found.");
    if (!canRetryPublication(publication.status)) {
      throw new AppError("VALIDATION_ERROR", "Publication cannot be retried.");
    }

    await prisma.publication.update({
      where: { id: publicationId },
      data: { status: "QUEUED" },
    });

    return this.execute(publicationId, organisationId, brandId, context, { requestId });
  },

  async preview(publicationId: string, organisationId: string, brandId: string, context: TenantContext) {
    return this.execute(publicationId, organisationId, brandId, context, { dryRun: true });
  },
};
