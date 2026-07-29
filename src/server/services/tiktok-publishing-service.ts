import type { PublishingJob } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  assertInteractionSettings,
  validateTikTokVideo,
} from "@/lib/content/tiktok-video-validation";
import { tikTokCredentialAdapter } from "@/lib/social/tiktok-credential-adapter";
import {
  TikTokProviderError,
  TikTokPublishingAdapter,
  type TikTokCreatorInfo,
} from "@/lib/social/tiktok-publishing-adapter";
import { createObjectStorageProvider } from "@/lib/storage/supabase-storage-provider";
import type { TenantContext } from "@/lib/tenancy/context";
import type {
  TikTokPublishRequestInput,
  TikTokPublishSettingsInput,
} from "@/lib/validation/tiktok-publishing";
import { recordAuditEvent } from "@/server/services/audit-service";
import { socialCredentialService } from "@/server/services/social-credential-service";
import { brandService } from "@/server/services/workspace-service";

export const MAX_TIKTOK_POLL_ATTEMPTS = 20;
const POLL_BASE_DELAY_MS = 5_000;
const MEDIA_URL_TTL_SECONDS = 3_600;

export type TikTokPublishOutcome =
  | { state: "PUBLISHED"; postId: string; publishId: string }
  | { state: "ALREADY_PUBLISHED"; postId: string }
  | { state: "PROCESSING"; publishId: string; pollingAttemptCount: number; nextPollAt: Date }
  | { state: "REQUEUED_AFTER_REFRESH" }
  | { state: "MANUAL_FALLBACK_REQUIRED"; reason: string }
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

async function failJob(job: PublishingJob, reason: string): Promise<TikTokPublishOutcome> {
  await recordAttempt(job, "FAILED", { errorMessage: reason });
  await prisma.publishingJob.update({
    where: { id: job.id },
    data: { status: "FAILED", lastProviderError: reason },
  });
  await prisma.contentSchedule.update({
    where: { id: job.contentScheduleId },
    data: { status: "FAILED" },
  });
  return { state: "FAILED", reason };
}

/** Errors that mean direct publishing can never succeed for this account or app. */
function requiresManualFallback(error: TikTokProviderError): boolean {
  return (
    error.code === "APP_NOT_APPROVED" ||
    error.code === "ACCOUNT_NOT_ELIGIBLE" ||
    error.code === "SCOPE_MISSING" ||
    error.code === "URL_OWNERSHIP_UNVERIFIED"
  );
}

async function markManualFallback(
  job: PublishingJob,
  reason: string,
): Promise<TikTokPublishOutcome> {
  await recordAttempt(job, "MANUAL_FALLBACK_REQUIRED", { errorMessage: reason });
  await prisma.publishingJob.update({
    where: { id: job.id },
    data: { status: "FAILED", directPublishAvailable: false, lastProviderError: reason },
  });
  // Content is deliberately not marked published; the user must confirm manually.
  await prisma.contentSchedule.update({
    where: { id: job.contentScheduleId },
    data: { status: "FAILED" },
  });
  return { state: "MANUAL_FALLBACK_REQUIRED", reason };
}

async function loadVariantForBrand(
  brandId: string,
  organisationId: string,
  contentVariantId: string,
) {
  const variant = await prisma.contentVariant.findFirst({
    where: { id: contentVariantId, organisationId, brandId, provider: "TIKTOK" },
    include: {
      contentItem: true,
      socialAccount: true,
      tikTokSetting: true,
      visualAssets: { include: { marketingAsset: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!variant) throw new AppError("NOT_FOUND", "TikTok content variant was not found.");
  return variant;
}

function primaryVideo(variant: Awaited<ReturnType<typeof loadVariantForBrand>>) {
  const asset = variant.visualAssets
    .map((entry) => entry.marketingAsset)
    .find((candidate) => candidate.assetType === "VIDEO");
  if (!asset)
    throw new AppError("VALIDATION_ERROR", "TikTok publishing requires an attached video asset.");
  return asset;
}

export const tikTokPublishingService = {
  /** Creator info drives the consent screen; TikTok's options are authoritative. */
  async getConsentContext(
    brandId: string,
    organisationId: string,
    contentVariantId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const variant = await loadVariantForBrand(brandId, organisationId, contentVariantId);
    if (!variant.socialAccount)
      throw new AppError("VALIDATION_ERROR", "Assign a connected TikTok account first.");

    const tokens = await socialCredentialService.readTokens(
      variant.socialAccount.socialConnectionId,
    );
    if (!tokens) throw new AppError("VALIDATION_ERROR", "TikTok credentials are unavailable.");

    const creatorInfo = await new TikTokPublishingAdapter().getCreatorInfo(tokens.accessToken);
    const asset = primaryVideo(variant);
    const previewUrl = await createObjectStorageProvider()
      .createSignedUrl(asset.storageKey, MEDIA_URL_TTL_SECONDS)
      .then((signed) => signed.url);

    return {
      account: {
        id: variant.socialAccount.id,
        username: creatorInfo.creatorUsername,
        nickname: creatorInfo.creatorNickname,
      },
      caption: variant.caption ?? "",
      previewUrl,
      creatorInfo,
      savedSettings: variant.tikTokSetting,
    };
  },

  /** Persists the creator's explicit posting choices. Nothing is defaulted to public. */
  async savePublishSettings(
    brandId: string,
    organisationId: string,
    input: TikTokPublishSettingsInput,
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const variant = await loadVariantForBrand(brandId, organisationId, input.contentVariantId);
    if (!variant.socialAccount)
      throw new AppError("VALIDATION_ERROR", "Assign a connected TikTok account first.");

    const tokens = await socialCredentialService.readTokens(
      variant.socialAccount.socialConnectionId,
    );
    if (!tokens) throw new AppError("VALIDATION_ERROR", "TikTok credentials are unavailable.");

    const creatorInfo = await new TikTokPublishingAdapter().getCreatorInfo(tokens.accessToken);
    const asset = primaryVideo(variant);
    const interaction = assertInteractionSettings(input, creatorInfo);

    const validation = validateTikTokVideo({
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      durationSeconds: asset.durationSeconds ? Number(asset.durationSeconds) : null,
      caption: variant.caption ?? "",
      privacyLevel: input.privacyLevel,
      commercialContent: input.commercialContent,
      brandOrganicToggle: input.brandOrganicToggle,
      brandedContentToggle: input.brandedContentToggle,
      audioRightsConfirmed: input.audioRightsConfirmed,
      creatorInfo,
    });
    if (!validation.valid) {
      throw new AppError("VALIDATION_ERROR", validation.errors.join(" "));
    }

    const setting = await prisma.tikTokPublishSetting.upsert({
      where: { contentVariantId: variant.id },
      create: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        contentVariantId: variant.id,
        privacyLevel: input.privacyLevel,
        ...interaction,
        commercialContent: input.commercialContent,
        brandOrganicToggle: input.brandOrganicToggle,
        brandedContentToggle: input.brandedContentToggle,
        videoCoverTimestampMs: input.videoCoverTimestampMs,
        creatorOptionsSnapshot: creatorInfo as never,
        selectedByUserId: context.userProfileId,
      },
      update: {
        privacyLevel: input.privacyLevel,
        ...interaction,
        commercialContent: input.commercialContent,
        brandOrganicToggle: input.brandOrganicToggle,
        brandedContentToggle: input.brandedContentToggle,
        videoCoverTimestampMs: input.videoCoverTimestampMs,
        creatorOptionsSnapshot: creatorInfo as never,
        selectedByUserId: context.userProfileId,
      },
    });

    return setting;
  },

  async enqueuePublish(
    brandId: string,
    organisationId: string,
    contentId: string,
    input: TikTokPublishRequestInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);

    const existing = await prisma.publishingJob.findFirst({
      where: { organisationId, brandId, idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;

    const content = await prisma.contentItem.findFirst({
      where: { id: contentId, organisationId, brandId, status: "APPROVED", archivedAt: null },
    });
    if (!content)
      throw new AppError("VALIDATION_ERROR", "Only approved content can be published to TikTok.");

    const variant = await loadVariantForBrand(brandId, organisationId, input.contentVariantId);
    if (variant.contentItemId !== content.id || variant.socialAccountId !== input.socialAccountId) {
      throw new AppError("VALIDATION_ERROR", "Confirm the assigned TikTok account and variant.");
    }
    if (!variant.tikTokSetting) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Confirm the TikTok posting settings before publishing.",
      );
    }

    const account = await prisma.socialAccount.findFirst({
      where: {
        id: input.socialAccountId,
        organisationId,
        brandId,
        provider: "TIKTOK",
        status: "CONNECTED",
        socialConnection: { status: "CONNECTED" },
      },
    });
    if (!account) throw new AppError("VALIDATION_ERROR", "TikTok account is not connected.");

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
      metadata: { provider: "TIKTOK", contentItemId: content.id },
    });

    return job;
  },

  /** One durable worker pass. Resumes from the persisted publish id after a restart. */
  async process(jobId: string): Promise<TikTokPublishOutcome | null> {
    const job = await prisma.publishingJob.findFirst({
      where: { id: jobId, status: { in: ["QUEUED", "PROCESSING"] } },
      include: {
        schedule: {
          include: {
            contentItem: true,
            contentVariant: {
              include: {
                tikTokSetting: true,
                visualAssets: { include: { marketingAsset: true }, orderBy: { sortOrder: "asc" } },
              },
            },
            socialAccount: true,
          },
        },
      },
    });
    if (!job) return null;

    if (job.publishedMediaId) {
      return { state: "ALREADY_PUBLISHED", postId: job.publishedMediaId };
    }

    const { schedule } = job;

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
    if (schedule.contentVariant.provider !== "TIKTOK") {
      return failJob(job, "Only TikTok variants can publish through this worker.");
    }

    const settings = schedule.contentVariant.tikTokSetting;
    if (!settings) return failJob(job, "TikTok posting settings were not confirmed.");

    const asset = schedule.contentVariant.visualAssets
      .map((entry) => entry.marketingAsset)
      .find(
        (candidate) =>
          candidate.assetType === "VIDEO" &&
          candidate.status === "READY" &&
          candidate.approvedForMarketing &&
          (!candidate.licenceExpiresAt || candidate.licenceExpiresAt > new Date()),
      );
    if (!asset) return failJob(job, "TikTok publishing requires an approved, unexpired video.");

    const tokens = await socialCredentialService.readTokens(
      schedule.socialAccount.socialConnectionId,
    );
    if (!tokens) return failJob(job, "TikTok credentials are unavailable.");

    await prisma.publishingJob.update({
      where: { id: job.id },
      data: { status: "PROCESSING", attemptCount: { increment: 1 } },
    });
    await prisma.contentSchedule.update({
      where: { id: schedule.id },
      data: { status: "PROCESSING" },
    });

    const adapter = new TikTokPublishingAdapter();

    try {
      let publishId = job.providerContainerId;

      if (!publishId) {
        const signed = await createObjectStorageProvider().createSignedUrl(
          asset.storageKey,
          MEDIA_URL_TTL_SECONDS,
        );
        publishId = await adapter.initDirectPost({
          accessToken: tokens.accessToken,
          videoUrl: signed.url,
          settings: {
            title: schedule.contentVariant.caption ?? "",
            privacyLevel: settings.privacyLevel,
            disableComment: settings.disableComment,
            disableDuet: settings.disableDuet,
            disableStitch: settings.disableStitch,
            brandContentToggle: settings.brandedContentToggle,
            brandOrganicToggle: settings.brandOrganicToggle,
            ...(settings.videoCoverTimestampMs !== null
              ? { videoCoverTimestampMs: settings.videoCoverTimestampMs }
              : {}),
          },
        });

        await prisma.publishingJob.update({
          where: { id: job.id },
          data: { providerContainerId: publishId, providerStatus: "PROCESSING_UPLOAD" },
        });
      }

      const status = await adapter.getPublishStatus(publishId, tokens.accessToken);
      const pollingAttemptCount = job.pollingAttemptCount + 1;

      if (status.status === "FAILED") {
        await prisma.publishingJob.update({
          where: { id: job.id },
          data: { providerStatus: "FAILED", pollingAttemptCount },
        });
        return failJob(job, status.failReason ?? "TikTok rejected the video during processing.");
      }

      if (status.status !== "PUBLISH_COMPLETE") {
        if (pollingAttemptCount >= MAX_TIKTOK_POLL_ATTEMPTS) {
          await prisma.publishingJob.update({
            where: { id: job.id },
            data: { providerStatus: status.status, pollingAttemptCount },
          });
          return failJob(job, "TikTok processing timed out.");
        }
        const nextPollAt = backoffFor(pollingAttemptCount);
        await prisma.publishingJob.update({
          where: { id: job.id },
          data: {
            status: "QUEUED",
            providerStatus: status.status,
            pollingAttemptCount,
            nextPollAt,
          },
        });
        return { state: "PROCESSING", publishId, pollingAttemptCount, nextPollAt };
      }

      const postId = status.postId ?? publishId;
      await prisma.publishingJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          providerStatus: "PUBLISH_COMPLETE",
          publishedMediaId: postId,
          pollingAttemptCount,
          lastProviderError: null,
        },
      });
      await recordAttempt(job, "COMPLETED", { providerResponse: { postId, publishId } });
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
        metadata: { provider: "TIKTOK", postId },
      });

      return { state: "PUBLISHED", postId, publishId };
    } catch (error) {
      const providerError =
        error instanceof TikTokProviderError
          ? error
          : new TikTokProviderError(
              "PROVIDER_ERROR",
              error instanceof Error ? error.message : "TikTok publishing failed.",
              false,
            );

      if (requiresManualFallback(providerError)) {
        return markManualFallback(job, providerError.message);
      }

      if (providerError.code === "TOKEN_EXPIRED") {
        if (job.refreshAttemptCount >= 1) {
          return failJob(
            job,
            "TikTok credentials remain invalid after refresh. Reconnect the account.",
          );
        }
        try {
          const refreshed = await tikTokCredentialAdapter.refreshAccessToken({
            refreshToken: tokens.refreshToken ?? "",
          });
          await socialCredentialService.upsertTokens(
            schedule.socialAccount.socialConnectionId,
            refreshed,
          );
          await prisma.publishingJob.update({
            where: { id: job.id },
            data: {
              status: "QUEUED",
              refreshAttemptCount: { increment: 1 },
              lastProviderError: providerError.message,
            },
          });
          await recordAttempt(job, "RETRY_AFTER_REFRESH", { errorMessage: providerError.message });
          return { state: "REQUEUED_AFTER_REFRESH" };
        } catch (refreshError) {
          return failJob(
            job,
            refreshError instanceof Error
              ? refreshError.message
              : "TikTok credential refresh failed.",
          );
        }
      }

      if (providerError.retryable && job.attemptCount + 1 < job.maxAttempts) {
        await recordAttempt(job, "RETRYING", { errorMessage: providerError.message });
        const nextPollAt = backoffFor(job.attemptCount + 1);
        await prisma.publishingJob.update({
          where: { id: job.id },
          data: { status: "QUEUED", lastProviderError: providerError.message, nextPollAt },
        });
        return {
          state: "PROCESSING",
          publishId: job.providerContainerId ?? "",
          pollingAttemptCount: job.pollingAttemptCount,
          nextPollAt,
        };
      }

      return failJob(job, providerError.message);
    }
  },

  async cancel(brandId: string, organisationId: string, jobId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const job = await prisma.publishingJob.findFirst({
      where: { id: jobId, organisationId, brandId },
      include: { schedule: { include: { socialAccount: true } } },
    });
    if (!job) throw new AppError("NOT_FOUND", "Publishing job was not found.");
    if (job.publishedMediaId)
      throw new AppError("VALIDATION_ERROR", "Published content cannot be cancelled.");

    if (job.providerContainerId) {
      const tokens = await socialCredentialService.readTokens(
        job.schedule.socialAccount.socialConnectionId,
      );
      if (tokens) {
        // TikTok only permits cancellation while processing; a rejection here is not fatal.
        await new TikTokPublishingAdapter()
          .cancelPublish(job.providerContainerId, tokens.accessToken)
          .catch(() => undefined);
      }
    }

    await prisma.publishingJob.update({ where: { id: job.id }, data: { status: "CANCELLED" } });
    await prisma.contentSchedule.update({
      where: { id: job.contentScheduleId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    return { cancelled: true };
  },

  /** Prepared package for mobile handoff when direct publishing is unavailable. */
  async getFallbackPackage(
    brandId: string,
    organisationId: string,
    contentVariantId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const variant = await loadVariantForBrand(brandId, organisationId, contentVariantId);
    const asset = primaryVideo(variant);
    const download = await createObjectStorageProvider().createSignedUrl(
      asset.storageKey,
      MEDIA_URL_TTL_SECONDS,
    );

    return {
      directPublishAvailable: false,
      downloadUrl: download.url,
      expiresAt: download.expiresAt,
      caption: variant.caption ?? "",
      hashtags: variant.hashtags,
      settings: variant.tikTokSetting,
      instructions:
        "Direct publishing is unavailable for this account. Download the video, post it in the TikTok app using these settings, then confirm the public URL here.",
    };
  },

  /** Records a manually completed post. Never called automatically. */
  async confirmManualPublication(
    brandId: string,
    organisationId: string,
    jobId: string,
    publicUrl: string,
    context: TenantContext,
    requestId?: string,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const job = await prisma.publishingJob.findFirst({
      where: { id: jobId, organisationId, brandId },
    });
    if (!job) throw new AppError("NOT_FOUND", "Publishing job was not found.");

    const updated = await prisma.publishingJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        directPublishAvailable: false,
        manualPublicUrl: publicUrl,
        manualConfirmedAt: new Date(),
        manualConfirmedByUserId: context.userProfileId,
      },
    });
    await prisma.contentSchedule.update({
      where: { id: job.contentScheduleId },
      data: { status: "COMPLETED" },
    });
    const schedule = await prisma.contentSchedule.findUnique({
      where: { id: job.contentScheduleId },
    });
    if (schedule) {
      await prisma.contentItem.update({
        where: { id: schedule.contentItemId },
        data: { status: "PUBLISHED" },
      });
    }
    await recordAuditEvent({
      organisationId,
      projectId: job.projectId,
      actorUserId: context.userProfileId,
      action: "content.publishedManually",
      resourceType: "publishingJob",
      resourceId: job.id,
      requestId,
      metadata: { provider: "TIKTOK", publicUrl },
    });

    return updated;
  },
};

export type { TikTokCreatorInfo };
