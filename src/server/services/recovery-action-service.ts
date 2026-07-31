import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { nextRetryDate } from "@/lib/notifications/retry-governance";
import type { RecoveryActionInput } from "@/lib/validation/notifications";
import { assertOrganisationScope, type TenantContext } from "@/lib/tenancy/context";
import { operationalAlertService } from "@/server/services/operational-alert-service";

export const recoveryActionService = {
  async execute(
    organisationId: string,
    alertId: string,
    input: RecoveryActionInput,
    context: TenantContext,
  ) {
    assertOrganisationScope(organisationId, context);
    const alert = await prisma.operationalAlert.findFirst({
      where: { id: alertId, organisationId },
    });
    if (!alert) throw new AppError("NOT_FOUND", "Operational alert was not found.");

    const existing = await prisma.recoveryAction.findUnique({
      where: {
        organisationId_idempotencyKey: {
          organisationId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing?.status === "COMPLETED") {
      return { action: existing, duplicate: true };
    }

    const action = await prisma.recoveryAction.upsert({
      where: {
        organisationId_idempotencyKey: {
          organisationId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      create: {
        organisationId,
        operationalAlertId: alertId,
        actorUserId: context.userProfileId,
        actionType: input.actionType,
        resourceType: input.resourceType ?? alert.resourceType,
        resourceId: input.resourceId ?? alert.resourceId,
        idempotencyKey: input.idempotencyKey,
        status: "PENDING",
      },
      update: {},
    });

    try {
      let result: Prisma.InputJsonValue = {};

      switch (input.actionType) {
        case "RETRY": {
          if (alert.resourceType === "PublishingJob") {
            const job = await prisma.publishingJob.findFirst({
              where: { id: alert.resourceId, organisationId },
            });
            if (!job) throw new AppError("NOT_FOUND", "Publishing job was not found.");
            if (job.deadLetterAt) {
              throw new AppError("VALIDATION_ERROR", "Job is in dead-letter state.");
            }
            const nextAttempt = job.attemptCount + 1;
            if (nextAttempt > job.maxAttempts) {
              await prisma.publishingJob.update({
                where: { id: job.id },
                data: { status: "FAILED", deadLetterAt: new Date(), nextRetryAt: null },
              });
              await prisma.operationalAlert.update({
                where: { id: alertId },
                data: { status: "DEAD_LETTER", nextRetryAt: null },
              });
              throw new AppError("VALIDATION_ERROR", "Maximum retry attempts exceeded.");
            }
            await prisma.publishingJob.update({
              where: { id: job.id },
              data: {
                status: "QUEUED",
                attemptCount: nextAttempt,
                nextRetryAt: nextRetryDate(nextAttempt),
                lastProviderError: null,
              },
            });
            result = { jobId: job.id, nextAttempt };
          } else {
            result = { message: "Retry queued for background worker." };
          }
          await prisma.operationalAlert.update({
            where: { id: alertId },
            data: {
              status: "RETRYING",
              attemptCount: { increment: 1 },
              lastAttemptAt: new Date(),
              nextRetryAt: nextRetryDate(alert.attemptCount + 1),
            },
          });
          break;
        }
        case "RESOLVE": {
          await operationalAlertService.resolve(
            organisationId,
            alertId,
            context.userProfileId,
            context,
          );
          result = { resolved: true };
          break;
        }
        case "CANCEL": {
          if (alert.resourceType === "PublishingJob") {
            await prisma.publishingJob.updateMany({
              where: { id: alert.resourceId, organisationId, status: { in: ["QUEUED", "PROCESSING"] } },
              data: { status: "CANCELLED", nextRetryAt: null },
            });
          }
          await prisma.operationalAlert.update({
            where: { id: alertId },
            data: { status: "CANCELLED", nextRetryAt: null },
          });
          result = { cancelled: true };
          break;
        }
        case "RECONNECT":
          result = {
            reconnectPath: alert.brandId
              ? `/social/connections?brandId=${alert.brandId}`
              : "/social/connections",
          };
          break;
        case "MANUAL_CONFIRM":
          result = {
            confirmPath: alert.brandId
              ? `/content?jobId=${alert.resourceId}`
              : `/operations/publishing`,
          };
          break;
        default:
          throw new AppError("VALIDATION_ERROR", "Unsupported recovery action.");
      }

      const completed = await prisma.recoveryAction.update({
        where: { id: action.id },
        data: {
          status: "COMPLETED",
          result,
          completedAt: new Date(),
        },
      });
      return { action: completed, duplicate: false };
    } catch (error) {
      await prisma.recoveryAction.update({
        where: { id: action.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Recovery action failed.",
          completedAt: new Date(),
        },
      });
      throw error;
    }
  },
};
