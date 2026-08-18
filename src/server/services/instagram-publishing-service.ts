import type { PublishingJob } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  InstagramProviderError,
  InstagramPublishingAdapter,
  type InstagramMediaType,
} from "@/lib/social/instagram-publishing-adapter";
import { metaCredentialAdapter } from "@/lib/social/meta-credential-adapter";
import { createObjectStorageProvider } from "@/lib/storage/supabase-storage-provider";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { complianceAgentService } from "@/server/services/compliance-agent-service";
import { socialCredentialService } from "@/server/services/social-credential-service";
import { assertAccountPublishingCapability } from "@/lib/publishing/capabilities";
import { isProviderPublishingDisabled } from "@/lib/publishing/config";
import { hasPublishingSchedule, nullToUndefined, resolveContentScheduleId } from "@/lib/publishing/schedule";
import { brandService } from "@/server/services/workspace-service";
import { notifyPublishingFailed, notifyPublishingSucceeded } from "@/lib/notifications/publishing-hooks";

/** Meta containers expire after 24h; bounded polling keeps a stuck job from running forever. */
export const MAX_POLL_ATTEMPTS = 12;
const POLL_BASE_DELAY_MS = 5_000;
const MEDIA_URL_TTL_SECONDS = 3_600;

export type PublishOutcome =
  | { state: "PUBLISHED"; postId: string; permalink: string | null; containerId: string }
  | { state: "ALREADY_PUBLISHED"; postId: string; permalink: string | null }
  | { state: "PROCESSING"; containerId: string; pollingAttemptCount: number; nextPollAt: Date }
  | { state: "REQUEUED_AFTER_REFRESH"; containerId: string | null }
  | { state: "FAILED"; reason: string };

function backoffFor(attempt: number): Date {
  return new Date(Date.now() + POLL_BASE_DELAY_MS * 2 ** Math.min(attempt, 5));
}

async function recordAttempt(
  job: PublishingJob,
  status: string,
  detail: { providerResponse?: unknown; errorMessage?: string },
) {
  const last = await prisma.publishingAttempt.findFirst({
    where: { publishingJobId: job.id },
    orderBy: { attemptNumber: "desc" },
  });
  await prisma.publishingAttempt.create({
    data: {
      publishingJobId: job.id,
      attemptNumber: (last?.attemptNumber ?? 0) + 1,
      status,
      providerResponse: (detail.providerResponse ?? undefined) as never,
      errorMessage: detail.errorMessage,
    },
  });
}

async function failJob(job: PublishingJob, reason: string): Promise<PublishOutcome> {
  await recordAttempt(job, "FAILED", { errorMessage: reason });
  await prisma.publishingJob.update({
    where: { id: job.id },
    data: { status: "FAILED", lastProviderError: reason },
  });
  if (job.contentScheduleId) {
    await prisma.contentSchedule.update({
      where: { id: job.contentScheduleId },
      data: { status: "FAILED" },
    });
  }
  await notifyPublishingFailed(job, "INSTAGRAM", reason).catch(() => undefined);
  return { state: "FAILED", reason };
}

export const instagramPublishingService = {
  /**
   * Creates a durable, idempotent publishing job for an approved Instagram variant.
   * The caller must have already confirmed the target account and preview.
   */
  async enqueueImmediatePublish(
    brandId: string,
    organisationId: string,
    contentId: string,
    input: { contentVariantId: string; socialAccountId: string; idempotencyKey: string },
    context: TenantContext,
    requestId?: string,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    if (isProviderPublishingDisabled("INSTAGRAM")) {
      throw new AppError(
        "FORBIDDEN",
        "Instagram publishing is temporarily disabled by an operator.",
      );
    }

    const existingJob = await prisma.publishingJob.findFirst({
      where: { organisationId, brandId, idempotencyKey: input.idempotencyKey },
    });
    if (existingJob) return existingJob;

    const content = await prisma.contentItem.findFirst({
      where: { id: contentId, organisationId, brandId, status: "APPROVED", archivedAt: null },
      include: { variants: true },
    });
    if (!content) {
      throw new AppError("VALIDATION_ERROR", "Only approved content can be published immediately.");
    }

    await complianceAgentService.assertPublishable(
      brandId,
      organisationId,
      contentId,
      context,
      input.contentVariantId,
    );

    const variant = content.variants.find((item) => item.id === input.contentVariantId);
    if (
      !variant ||
      variant.provider !== "INSTAGRAM" ||
      variant.socialAccountId !== input.socialAccountId
    ) {
      throw new AppError("VALIDATION_ERROR", "Confirm the assigned Instagram account and variant.");
    }

    const account = await prisma.socialAccount.findFirst({
      where: {
        id: input.socialAccountId,
        organisationId,
        brandId,
        provider: "INSTAGRAM",
        status: "CONNECTED",
        socialConnection: { status: "CONNECTED" },
      },
    });
    if (!account) throw new AppError("VALIDATION_ERROR", "Instagram account is not connected.");
    await assertAccountPublishingCapability(account.id, variant.format);

    const schedule = await prisma.contentSchedule.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        contentItemId: content.id,
        contentVariantId: variant.id,
        socialAccountId: account.id,
        scheduledFor: new Date(),
        timezone: "UTC",
        status: "QUEUED",
        createdByUserId: context.userProfileId,
      },
    });

    const job = await prisma.publishingJob.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        contentScheduleId: schedule.id,
        idempotencyKey: input.idempotencyKey,
        status: "QUEUED",
      },
    });

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "content.publishRequested",
      resourceType: "publishingJob",
      resourceId: job.id,
      requestId,
      metadata: { provider: "INSTAGRAM", contentItemId: content.id },
    });

    return job;
  },

  /**
   * Executes one worker pass. The job carries all provider state, so an interrupted
   * run resumes from the persisted container rather than creating a new one.
   */
  async process(jobId: string): Promise<PublishOutcome | null> {
    const job = await prisma.publishingJob.findFirst({
      where: { id: jobId, status: { in: ["QUEUED", "PROCESSING"] } },
      include: {
        schedule: {
          include: {
            contentItem: true,
            contentVariant: { include: { visualAssets: { include: { marketingAsset: true } } } },
            socialAccount: true,
          },
        },
      },
    });
    if (!job) return null;
    if (!job.schedule) return null;

    // A completed publish is never repeated, even if the worker is invoked again.
    if (job.publishedMediaId) {
      return { state: "ALREADY_PUBLISHED", postId: job.publishedMediaId, permalink: job.permalink };
    }

    const scheduleId = resolveContentScheduleId(job);
    if (!hasPublishingSchedule(job) || !scheduleId) {
      return failJob(job, "Publishing job requires a content schedule for legacy provider execution.");
    }
    const schedule = job.schedule;

    // Every related record must belong to the same tenant as the job itself.
    if (
      schedule.organisationId !== job.organisationId ||
      schedule.brandId !== job.brandId ||
      schedule.contentVariant.organisationId !== job.organisationId ||
      schedule.contentVariant.brandId !== job.brandId ||
      schedule.socialAccount.organisationId !== job.organisationId ||
      schedule.socialAccount.brandId !== job.brandId
    ) {
      return failJob(job, "Publishing job references records from another tenant.");
    }

    if (schedule.contentItem.status !== "APPROVED" && schedule.contentItem.status !== "SCHEDULED") {
      return failJob(job, "Only approved content can be published.");
    }
    if (
      schedule.contentVariant.provider !== "INSTAGRAM" ||
      !schedule.contentVariant.socialAccountId
    ) {
      return failJob(job, "Only assigned Instagram variants can publish.");
    }

    const now = new Date();
    const assets = schedule.contentVariant.visualAssets
      .map((item) => item.marketingAsset)
      .filter(
        (asset) =>
          asset.status === "READY" &&
          asset.approvedForMarketing &&
          (!asset.licenceExpiresAt || asset.licenceExpiresAt > now),
      );
    if (assets.length === 0) {
      return failJob(job, "Instagram publishing requires approved, unexpired media.");
    }

    const tokens = await socialCredentialService.readTokens(
      schedule.socialAccount.socialConnectionId,
    );
    if (!tokens) return failJob(job, "Instagram credentials are unavailable.");

    await prisma.publishingJob.update({
      where: { id: job.id },
      data: { status: "PROCESSING", attemptCount: { increment: 1 } },
    });
    await prisma.contentSchedule.update({
      where: { id: schedule.id },
      data: { status: "PROCESSING" },
    });

    const adapter = new InstagramPublishingAdapter();
    const igUserId = schedule.socialAccount.providerAccountId;

    try {
      let containerId = job.providerContainerId;

      if (!containerId) {
        const storage = createObjectStorageProvider();
        const mediaUrls: string[] = [];
        for (const asset of assets) {
          const signed = await storage.createSignedUrl(asset.storageKey, MEDIA_URL_TTL_SECONDS);
          mediaUrls.push(signed.url);
        }

        const mediaType: InstagramMediaType = assets.some((asset) => asset.assetType === "VIDEO")
          ? "REELS"
          : assets.length > 1
            ? "CAROUSEL"
            : "IMAGE";

        containerId = await adapter.createContainer({
          igUserId,
          accessToken: tokens.accessToken,
          caption: schedule.contentVariant.caption ?? undefined,
          altText: schedule.contentVariant.altText ?? undefined,
          mediaUrls,
          mediaType,
        });

        // Persisted before any polling so a restart reuses this container.
        await prisma.publishingJob.update({
          where: { id: job.id },
          data: { providerContainerId: containerId, providerStatus: "IN_PROGRESS" },
        });
      }

      const { status } = await adapter.getContainerStatus(containerId, tokens.accessToken);
      const pollingAttemptCount = job.pollingAttemptCount + 1;

      if (status === "ERROR" || status === "EXPIRED") {
        await prisma.publishingJob.update({
          where: { id: job.id },
          data: { providerStatus: status, pollingAttemptCount },
        });
        return failJob(job, `Instagram container ${status.toLowerCase()}.`);
      }

      if (status !== "FINISHED" && status !== "PUBLISHED") {
        if (pollingAttemptCount >= MAX_POLL_ATTEMPTS) {
          await prisma.publishingJob.update({
            where: { id: job.id },
            data: { providerStatus: status, pollingAttemptCount },
          });
          return failJob(job, "Instagram media processing timed out.");
        }

        const nextPollAt = backoffFor(pollingAttemptCount);
        await prisma.publishingJob.update({
          where: { id: job.id },
          data: { status: "QUEUED", providerStatus: status, pollingAttemptCount, nextPollAt },
        });
        return { state: "PROCESSING", containerId, pollingAttemptCount, nextPollAt };
      }

      const postId = await adapter.publishContainer(igUserId, containerId, tokens.accessToken);
      const permalink = await adapter.getPermalink(postId, tokens.accessToken);

      await prisma.publishingJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          providerStatus: "PUBLISHED",
          publishedMediaId: postId,
          permalink,
          pollingAttemptCount,
          lastProviderError: null,
        },
      });
      await recordAttempt(job, "COMPLETED", {
        providerResponse: { postId, permalink, containerId },
      });
      await prisma.contentSchedule.update({
        where: { id: schedule.id },
        data: { status: "COMPLETED" },
      });
      await prisma.contentItem.update({
        where: { id: schedule.contentItemId },
        data: { status: "PUBLISHED" },
      });
      await recordAuditEvent({
        organisationId: job.organisationId,
        projectId: job.projectId,
        actorUserId: schedule.createdByUserId,
        action: "content.published",
        resourceType: "publishingJob",
        resourceId: job.id,
        metadata: { provider: "INSTAGRAM", postId, permalink },
      });
      await notifyPublishingSucceeded(job).catch(() => undefined);

      return { state: "PUBLISHED", postId, permalink, containerId };
    } catch (error) {
      const providerError =
        error instanceof InstagramProviderError
          ? error
          : new InstagramProviderError(
              "PROVIDER_ERROR",
              error instanceof Error ? error.message : "Instagram publishing failed.",
              false,
            );

      if (providerError.code === "TOKEN_EXPIRED") {
        // Exactly one refresh + requeue; a second expiry is terminal.
        if (job.refreshAttemptCount >= 1) {
          return failJob(
            job,
            "Instagram credentials remain invalid after refresh. Reconnect the account.",
          );
        }
        try {
          const refreshed = await metaCredentialAdapter.refreshAccessToken({
            accessToken: tokens.accessToken,
          });
          await socialCredentialService.upsertTokens(schedule.socialAccount.socialConnectionId, {
            ...refreshed,
            refreshToken: tokens.refreshToken,
          });
          await prisma.publishingJob.update({
            where: { id: job.id },
            data: {
              status: "QUEUED",
              refreshAttemptCount: { increment: 1 },
              lastProviderError: providerError.message,
            },
          });
          await recordAttempt(job, "RETRY_AFTER_REFRESH", { errorMessage: providerError.message });
          return { state: "REQUEUED_AFTER_REFRESH", containerId: job.providerContainerId };
        } catch (refreshError) {
          const message =
            refreshError instanceof Error
              ? refreshError.message
              : "Instagram credential refresh failed.";
          return failJob(job, message);
        }
      }

      if (providerError.retryable && job.attemptCount + 1 < job.maxAttempts) {
        await recordAttempt(job, "RETRYING", { errorMessage: providerError.message });
        await prisma.publishingJob.update({
          where: { id: job.id },
          data: {
            status: "QUEUED",
            lastProviderError: providerError.message,
            nextPollAt: backoffFor(job.attemptCount + 1),
          },
        });
        return {
          state: "PROCESSING",
          containerId: job.providerContainerId ?? "",
          pollingAttemptCount: job.pollingAttemptCount,
          nextPollAt: backoffFor(job.attemptCount + 1),
        };
      }

      return failJob(job, providerError.message);
    }
  },
};
