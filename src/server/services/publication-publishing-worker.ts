import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logging";
import { incrementPublishingCounter } from "@/lib/publishing/observability";
import { operationToCapability } from "@/lib/publishing/outbound-operations";
import {
  assertPublicationTransition,
  mapTokenFailureToPublicationStatus,
} from "@/lib/publishing/publication-lifecycle";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { calendarProjectionService } from "@/server/services/calendar-projection-service";
import { notificationEventService } from "@/server/services/notification-event-service";
import { providerGateway } from "@/server/services/provider-gateway-service";
import { providerAuditService } from "@/server/services/provider-audit-service";
import { createObjectStorageProvider } from "@/lib/storage/supabase-storage-provider";
import { tokenLifecycleService } from "@/server/services/token-lifecycle-service";

const MAX_ATTEMPTS = 3;
const MEDIA_URL_TTL_SECONDS = 3600;

async function resolveContentMediaUrls(contentItemId: string): Promise<string[]> {
  const assets = await prisma.contentAsset.findMany({
    where: { contentItemId },
    include: { marketingAsset: { select: { storageKey: true, status: true } } },
    orderBy: { sortOrder: "asc" },
  });

  const storage = createObjectStorageProvider();
  const urls: string[] = [];
  for (const asset of assets) {
    if (asset.marketingAsset.status !== "READY") continue;
    const signed = await storage.createSignedUrl(asset.marketingAsset.storageKey, MEDIA_URL_TTL_SECONDS);
    urls.push(signed.url);
  }
  return urls;
}

function jobLockKey(jobId: string): bigint {
  let hash = 0;
  for (let i = 0; i < jobId.length; i += 1) {
    hash = (hash * 31 + jobId.charCodeAt(i)) | 0;
  }
  return BigInt(Math.abs(hash));
}

function mapOperationToGatewayOperation(operationType: string): string {
  if (operationType.startsWith("SOCIAL_")) {
    if (operationType === "SOCIAL_CANCEL_SCHEDULED") return "cancelScheduledPost";
    if (operationType === "SOCIAL_GET_STATUS") return "getPublicationStatus";
    if (operationType === "SOCIAL_SCHEDULE_POST") return "schedulePost";
    return "publishPost";
  }
  return "execute";
}

function classifyRetry(errorCode?: string, retryable?: boolean): {
  category: "RETRYABLE" | "NON_RETRYABLE" | "REAUTH_REQUIRED";
  retryable: boolean;
} {
  if (errorCode === "PROVIDER_AUTH_FAILED" || errorCode === "REAUTH_REQUIRED" || errorCode === "TOKEN_EXPIRED") {
    return { category: "REAUTH_REQUIRED", retryable: false };
  }
  if (
    retryable ||
    errorCode === "PROVIDER_RATE_LIMITED" ||
    errorCode === "PROVIDER_TIMEOUT" ||
    errorCode === "PROVIDER_UNAVAILABLE" ||
    errorCode === "TRANSIENT" ||
    errorCode === "RATE_LIMITED"
  ) {
    return { category: "RETRYABLE", retryable: true };
  }
  return { category: "NON_RETRYABLE", retryable: false };
}

export type PublicationJobOutcome =
  | { state: "PUBLISHED"; externalPublicationId?: string; permalink?: string | null }
  | { state: "FAILED"; reason: string; category: string }
  | { state: "REAUTH_REQUIRED"; reason: string }
  | { state: "DUPLICATE"; externalPublicationId?: string }
  | { state: "SKIPPED"; reason: string };

/**
 * Canonical worker entry point for Publication-backed PublishingJob records.
 * Routes must delegate here — do not duplicate provider execution logic.
 */
export async function processPublicationPublishingJob(
  jobId: string,
  context?: TenantContext,
): Promise<PublicationJobOutcome | null> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${jobLockKey(jobId)})`;

    const job = await tx.publishingJob.findUnique({
      where: { id: jobId },
      include: {
        publication: {
          include: {
            contentItem: { include: { variants: true } },
          },
        },
      },
    });

    if (!job?.publicationId || !job.publication) {
      return null;
    }

    if (job.status === "COMPLETED" || job.status === "CANCELLED") {
      return { state: "SKIPPED", reason: `Job already ${job.status}.` };
    }

    if (job.status !== "QUEUED" && job.status !== "PROCESSING") {
      return { state: "SKIPPED", reason: `Job not executable (${job.status}).` };
    }

    const publication = job.publication;
    const tenantContext = context ?? {
      organisationId: publication.organisationId,
      userProfileId: publication.requestedByUserId,
      organisationRole: "ADMIN" as const,
      authUserId: publication.requestedByUserId,
      projectId: publication.projectId,
      brandId: publication.brandId,
    };

    if (context && context.organisationId !== publication.organisationId) {
      throw new AppError("FORBIDDEN", "Publication tenant mismatch.");
    }

    const tokenResult = await tokenLifecycleService.getValidAccessToken(
      { organisationId: publication.organisationId, actorUserId: tenantContext.userProfileId },
      publication.connectionId,
    );

    if (!tokenResult.accessToken) {
      const mapped = mapTokenFailureToPublicationStatus(tokenResult.status);
      await tx.publication.update({
        where: { id: publication.id },
        data: {
          status: mapped.status,
          lastErrorCode: mapped.errorCode,
          lastErrorMessage: "Provider connection requires reauthorization.",
        },
      });
      await tx.publishingJob.update({
        where: { id: jobId },
        data: { status: "FAILED", lastProviderError: mapped.errorCode },
      });
      return { state: "REAUTH_REQUIRED", reason: mapped.errorCode };
    }

    await tx.publishingJob.update({
      where: { id: jobId },
      data: { status: "PROCESSING", attemptCount: { increment: 1 } },
    });

    assertPublicationTransition(publication.status, "PUBLISHING");
    await tx.publication.update({
      where: { id: publication.id },
      data: { status: "PUBLISHING" },
    });

    const attemptNumber =
      (await tx.publicationAttempt.count({ where: { publicationId: publication.id } })) + 1;

    const attempt = await tx.publicationAttempt.create({
      data: {
        publicationId: publication.id,
        attemptNumber,
        status: "RUNNING",
        dryRun: publication.dryRun,
        requestId: crypto.randomUUID(),
        startedAt: new Date(),
      },
    });

    const variant = publication.contentVariantId
      ? publication.contentItem.variants.find((v) => v.id === publication.contentVariantId)
      : publication.contentItem.variants[0];

    const mediaUrls =
      (publication.providerPayload as { mediaUrls?: string[] } | null)?.mediaUrls ??
      (await resolveContentMediaUrls(publication.contentItemId));

    const capability = operationToCapability(publication.operationType);
    const gatewayOperation = mapOperationToGatewayOperation(publication.operationType);

    incrementPublishingCounter("publishing.job_started", 1, {
      jobId,
      publicationId: publication.id,
      providerKey: publication.providerKey,
    });

    let result;
    try {
      result = await providerGateway.execute(
        {
          organisationId: publication.organisationId,
          connectionId: publication.connectionId,
          capability,
          operation: gatewayOperation,
          input: {
            ...(publication.providerPayload as Record<string, unknown> | null),
            externalAccountId: publication.externalAccountId,
            destinationId: publication.destinationId,
            caption: variant?.caption ?? publication.contentItem.primaryMessage,
            mediaUrls,
            scheduledFor: publication.scheduledFor?.toISOString(),
            timezone: publication.timezone,
          },
          idempotencyKey: publication.idempotencyKey,
          correlationId: attempt.requestId ?? undefined,
        },
        tenantContext,
      );
    } catch (error) {
      result = {
        success: false,
        errorCode: "PROVIDER_UNAVAILABLE",
        errorMessageSafe: error instanceof Error ? error.message : "Provider execution failed.",
        retryable: true,
      };
    }

    if (!result.success) {
      const classification = classifyRetry(result.errorCode, result.retryable);
      const terminal = job.attemptCount >= MAX_ATTEMPTS || !classification.retryable;

      await tx.publicationAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "FAILED",
          errorCode: result.errorCode,
          errorMessageSafe: result.errorMessageSafe,
          completedAt: new Date(),
        },
      });

      await tx.publication.update({
        where: { id: publication.id },
        data: {
          status: terminal ? "FAILED" : "QUEUED",
          lastErrorCode: result.errorCode ?? classification.category,
          lastErrorMessage: result.errorMessageSafe,
        },
      });

      await tx.publishingJob.update({
        where: { id: jobId },
        data: {
          status: terminal ? "FAILED" : "QUEUED",
          lastProviderError: result.errorMessageSafe,
          nextRetryAt: classification.retryable
            ? new Date(Date.now() + 30_000 * job.attemptCount)
            : null,
          deadLetterAt: terminal ? new Date() : null,
        },
      });

      incrementPublishingCounter("publishing.job_failed", 1, {
        jobId,
        category: classification.category,
        providerKey: publication.providerKey,
      });

      if (classification.category === "REAUTH_REQUIRED") {
        await recordAuditEvent({
          organisationId: publication.organisationId,
          actorUserId: tenantContext.userProfileId,
          action: "publication.reauth_required",
          resourceType: "publication",
          resourceId: publication.id,
        }).catch(() => undefined);
      }

      return {
        state: classification.category === "REAUTH_REQUIRED" ? "REAUTH_REQUIRED" : "FAILED",
        reason: result.errorMessageSafe ?? "Publication failed.",
        category: classification.category,
      };
    }

    const data = result.data as Record<string, unknown> | undefined;
    const externalId = data?.externalPublicationId ? String(data.externalPublicationId) : undefined;
    const permalink = data?.permalink ? String(data.permalink) : undefined;
    const duplicate = Boolean(data?.duplicate);

    await tx.publicationAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "SUCCEEDED",
        providerResponse: data as object,
        completedAt: new Date(),
      },
    });

    const isScheduledFuture =
      publication.scheduledFor && publication.scheduledFor > new Date();

    await tx.publication.update({
      where: { id: publication.id },
      data: {
        status: isScheduledFuture ? "SCHEDULED" : "PUBLISHED",
        externalPublicationId: externalId,
        providerPermalink: permalink,
        publishedAt: isScheduledFuture ? null : new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });

    await tx.publishingJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        permalink: permalink ?? null,
        publishedMediaId: externalId ?? null,
      },
    });

    await calendarProjectionService.syncPublication(publication.id).catch((error) => {
      logger.warn("publishing.calendar_projection_failed", {
        publicationId: publication.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    await providerAuditService.recordEvent({
      organisationId: publication.organisationId,
      providerKey: publication.providerKey,
      connectionId: publication.connectionId,
      action: "SYNC_COMPLETED",
      actorUserId: tenantContext.userProfileId,
      requestId: attempt.requestId ?? undefined,
      result: "success",
      metadata: { publicationId: publication.id, externalPublicationId: externalId },
    }).catch(() => undefined);

    await recordAuditEvent({
      organisationId: publication.organisationId,
      actorUserId: tenantContext.userProfileId,
      action: "publication.succeeded",
      resourceType: "publication",
      resourceId: publication.id,
      metadata: { externalPublicationId: externalId },
    }).catch(() => undefined);

    // Notification is best-effort — must not reverse publication success
    if (!duplicate) {
      notificationEventService
        .publicationSucceeded({
          organisationId: publication.organisationId,
          brandId: publication.brandId,
          publicationId: publication.id,
          recipientUserIds: [tenantContext.userProfileId],
          idempotencyKey: `pub-success:${publication.idempotencyKey}`,
        })
        .catch((error) => {
          logger.warn("publishing.notification_failed", {
            publicationId: publication.id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    }

    incrementPublishingCounter("publishing.job_succeeded", 1, {
      jobId,
      publicationId: publication.id,
      providerKey: publication.providerKey,
      duplicate: duplicate ? "true" : "false",
    });

    if (duplicate) {
      incrementPublishingCounter("publishing.duplicate_prevented", 1, {
        publicationId: publication.id,
      });
      return { state: "DUPLICATE", externalPublicationId: externalId };
    }

    return { state: "PUBLISHED", externalPublicationId: externalId, permalink };
  });
}
