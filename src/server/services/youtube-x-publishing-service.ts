import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { createObjectStorageProvider } from "@/lib/storage/supabase-storage-provider";
import type { TenantContext } from "@/lib/tenancy/context";
import type { z } from "zod";
import { XProviderError, XPublishingAdapter } from "@/lib/social/x-publishing-adapter";
import {
  YouTubeProviderError,
  YouTubePublishingAdapter,
} from "@/lib/social/youtube-publishing-adapter";
import {
  xCredentialAdapter,
  youtubeCredentialAdapter,
} from "@/lib/social/youtube-x-credential-adapters";
import { xPublishSchema, youtubePublishSchema } from "@/lib/validation/youtube-x-publishing";
import { socialCredentialService } from "@/server/services/social-credential-service";
import { brandService } from "@/server/services/workspace-service";

type YouTubeInput = z.infer<typeof youtubePublishSchema>;
type XInput = z.infer<typeof xPublishSchema>;
type Settings =
  | ({ provider: "YOUTUBE" } & Omit<
      YouTubeInput,
      "contentVariantId" | "socialAccountId" | "confirmed" | "idempotencyKey"
    >)
  | ({ provider: "X" } & Omit<
      XInput,
      "contentVariantId" | "socialAccountId" | "confirmed" | "idempotencyKey"
    >);

const MAX_POLLS = 15;
const nextPoll = (attempt: number) => new Date(Date.now() + 5_000 * 2 ** Math.min(attempt, 5));

async function attempt(jobId: string, status: string, response?: unknown, error?: string) {
  const last = await prisma.publishingAttempt.findFirst({
    where: { publishingJobId: jobId },
    orderBy: { attemptNumber: "desc" },
  });
  await prisma.publishingAttempt.create({
    data: {
      publishingJobId: jobId,
      attemptNumber: (last?.attemptNumber ?? 0) + 1,
      status,
      providerResponse: response as Prisma.InputJsonValue | undefined,
      errorMessage: error,
    },
  });
}

export const youtubeXPublishingService = {
  async getFallbackPackage(
    brandId: string,
    organisationId: string,
    contentVariantId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const variant = await prisma.contentVariant.findFirst({
      where: { id: contentVariantId, organisationId, brandId, provider: { in: ["YOUTUBE", "X"] } },
      include: {
        visualAssets: { include: { marketingAsset: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    if (!variant) throw new AppError("NOT_FOUND", "Platform variant was not found.");
    const files = await Promise.all(
      variant.visualAssets.map(async (entry) => ({
        title: entry.marketingAsset.title,
        mimeType: entry.marketingAsset.mimeType,
        url: (
          await createObjectStorageProvider().createSignedUrl(entry.marketingAsset.storageKey, 3600)
        ).url,
      })),
    );
    return {
      status: "Manual publishing required",
      provider: variant.provider,
      text: variant.caption ?? "",
      title: variant.headline ?? "",
      description: variant.description ?? "",
      destinationUrl: variant.destinationUrl,
      files,
      thumbnailAssetId: variant.thumbnailAssetId,
    };
  },

  async enqueue(
    brandId: string,
    organisationId: string,
    contentId: string,
    input: YouTubeInput | XInput,
    provider: "YOUTUBE" | "X",
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const existing = await prisma.publishingJob.findFirst({
      where: { organisationId, brandId, idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
    const content = await prisma.contentItem.findFirst({
      where: { id: contentId, organisationId, brandId, status: "APPROVED" },
    });
    if (!content) throw new AppError("VALIDATION_ERROR", "Only approved content can be published.");
    const variant = await prisma.contentVariant.findFirst({
      where: {
        id: input.contentVariantId,
        contentItemId: content.id,
        organisationId,
        brandId,
        provider,
        socialAccountId: input.socialAccountId,
      },
      include: {
        socialAccount: { include: { socialConnection: true } },
        visualAssets: { include: { marketingAsset: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    if (!variant?.socialAccount || variant.socialAccount.status !== "CONNECTED") {
      throw new AppError("VALIDATION_ERROR", "The selected provider account is not connected.");
    }
    if (provider === "YOUTUBE") {
      const youtube = input as YouTubeInput;
      const video = variant.visualAssets.find(
        (entry) => entry.marketingAsset.assetType === "VIDEO",
      )?.marketingAsset;
      if (
        !video ||
        !["video/mp4", "video/quicktime"].includes(video.mimeType) ||
        !video.width ||
        !video.height ||
        video.width / video.height > 9 / 16 + 0.01 ||
        !video.durationSeconds ||
        Number(video.durationSeconds) > 180
      ) {
        throw new AppError(
          "VALIDATION_ERROR",
          "YouTube Shorts require a validated vertical video no longer than 180 seconds.",
        );
      }
      if (youtube.scheduledPublishAt && new Date(youtube.scheduledPublishAt) <= new Date()) {
        throw new AppError("VALIDATION_ERROR", "Scheduled publication must be in the future.");
      }
    }
    for (const entry of variant.visualAssets) {
      const asset = entry.marketingAsset;
      if (
        asset.status !== "READY" ||
        !asset.approvedForMarketing ||
        (asset.licenceExpiresAt && asset.licenceExpiresAt <= new Date())
      ) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Attached media must be ready, approved, and licensed.",
        );
      }
    }
    const schedule = await prisma.contentSchedule.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        contentItemId: content.id,
        contentVariantId: variant.id,
        socialAccountId: variant.socialAccount.id,
        scheduledFor: new Date(),
        timezone: "UTC",
        status: "QUEUED",
        createdByUserId: context.userProfileId,
      },
    });
    const providerValues = { ...input } as Record<string, unknown>;
    const idempotencyKey = input.idempotencyKey;
    delete providerValues.contentVariantId;
    delete providerValues.socialAccountId;
    delete providerValues.confirmed;
    delete providerValues.idempotencyKey;
    return prisma.publishingJob.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        contentScheduleId: schedule.id,
        idempotencyKey,
        status: "QUEUED",
        providerSettings: { provider, ...providerValues },
      },
    });
  },

  async process(jobId: string) {
    const job = await prisma.publishingJob.findFirst({
      where: { id: jobId, status: { in: ["QUEUED", "PROCESSING", "PARTIALLY_COMPLETED"] } },
      include: {
        schedule: {
          include: {
            contentItem: true,
            socialAccount: true,
            contentVariant: {
              include: {
                visualAssets: { include: { marketingAsset: true }, orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
      },
    });
    if (!job) return null;
    if (job.publishedMediaId) return { state: "ALREADY_PUBLISHED", postId: job.publishedMediaId };
    const settings = job.providerSettings as Settings;
    const { schedule } = job;
    if (
      schedule.organisationId !== job.organisationId ||
      schedule.socialAccount.organisationId !== job.organisationId
    ) {
      throw new AppError("FORBIDDEN", "Publishing job references another tenant.");
    }
    const tokens = await socialCredentialService.readTokens(
      schedule.socialAccount.socialConnectionId,
    );
    if (!tokens) throw new AppError("VALIDATION_ERROR", "Provider credentials are unavailable.");
    const assets = schedule.contentVariant.visualAssets.map((entry) => entry.marketingAsset);
    const storage = createObjectStorageProvider();
    await prisma.publishingJob.update({
      where: { id: job.id },
      data: { status: "PROCESSING", attemptCount: { increment: 1 } },
    });

    try {
      let postId: string;
      let permalink: string | null = null;
      if (settings.provider === "YOUTUBE") {
        const adapter = new YouTubePublishingAdapter();
        const state =
          (job.providerUploadState as {
            uploadUrl?: string;
            videoId?: string;
            thumbnailDone?: boolean;
            uploadAttempts?: number;
            quotaUnitsUsed?: number;
          } | null) ?? {};
        const video = assets.find((asset) => asset.assetType === "VIDEO")!;
        if (!state.uploadUrl) {
          state.uploadUrl = await adapter.initialiseUpload({
            accessToken: tokens.accessToken,
            mimeType: video.mimeType,
            sizeBytes: video.sizeBytes,
            metadata: settings,
          });
          state.uploadAttempts = (state.uploadAttempts ?? 0) + 1;
          state.quotaUnitsUsed = (state.quotaUnitsUsed ?? 0) + 1;
          await prisma.publishingJob.update({
            where: { id: job.id },
            data: { providerUploadState: state, providerStatus: "UPLOAD_INITIALISED" },
          });
        }
        if (!state.videoId) {
          const signed = await storage.createSignedUrl(video.storageKey, 3600);
          state.videoId = await adapter.uploadVideo(state.uploadUrl, signed.url, video.mimeType);
          await prisma.publishingJob.update({
            where: { id: job.id },
            data: {
              providerContainerId: state.videoId,
              providerUploadState: state,
              providerStatus: "PROCESSING",
            },
          });
        }
        const processing = await adapter.getProcessingStatus(state.videoId, tokens.accessToken);
        if (processing.status === "FAILED") {
          throw new YouTubeProviderError(
            "PROCESSING_FAILED",
            processing.error ?? "YouTube processing failed.",
            false,
          );
        }
        if (processing.status === "PROCESSING") {
          const count = job.pollingAttemptCount + 1;
          if (count >= MAX_POLLS) {
            throw new YouTubeProviderError(
              "PROCESSING_FAILED",
              "YouTube processing timed out.",
              false,
            );
          }
          const pollAt = nextPoll(count);
          await prisma.publishingJob.update({
            where: { id: job.id },
            data: {
              status: "QUEUED",
              pollingAttemptCount: count,
              nextPollAt: pollAt,
              providerUploadState: state,
            },
          });
          return { state: "PROCESSING", nextPollAt: pollAt };
        }
        const thumbnail = assets.find(
          (asset) =>
            asset.assetType === "IMAGE" && asset.id === schedule.contentVariant.thumbnailAssetId,
        );
        if (thumbnail && !state.thumbnailDone) {
          const signed = await storage.createSignedUrl(thumbnail.storageKey, 3600);
          await adapter.uploadThumbnail(
            state.videoId,
            tokens.accessToken,
            signed.url,
            thumbnail.mimeType,
          );
          state.thumbnailDone = true;
          await prisma.publishingJob.update({
            where: { id: job.id },
            data: { providerUploadState: state },
          });
        }
        postId = state.videoId;
        permalink = `https://www.youtube.com/watch?v=${postId}`;
      } else {
        const adapter = new XPublishingAdapter();
        const state = (job.providerUploadState as {
          mediaIds?: string[];
          postIds?: string[];
          mediaReady?: boolean;
        } | null) ?? { mediaIds: [], postIds: [] };
        state.mediaIds ??= [];
        state.postIds ??= [];
        for (let index = state.mediaIds.length; index < assets.length; index += 1) {
          const asset = assets[index]!;
          const signed = await storage.createSignedUrl(asset.storageKey, 3600);
          const upload = await adapter.uploadMedia({
            accessToken: tokens.accessToken,
            sourceUrl: signed.url,
            mimeType: asset.mimeType,
            sizeBytes: asset.sizeBytes,
            category: asset.assetType === "VIDEO" ? "tweet_video" : "tweet_image",
          });
          state.mediaIds.push(upload.mediaId);
          state.mediaReady = !upload.processingInfo;
          await prisma.publishingJob.update({
            where: { id: job.id },
            data: {
              providerContainerId: upload.mediaId,
              providerUploadState: state,
              providerStatus: state.mediaReady ? "AVAILABLE" : "PROCESSING",
            },
          });
        }
        if (!state.mediaReady && state.mediaIds.length) {
          let processing = false;
          for (const mediaId of state.mediaIds) {
            const status = await adapter.getMediaStatus(mediaId, tokens.accessToken);
            if (status.status === "FAILED") {
              throw new XProviderError(
                "MEDIA_FAILED",
                status.error ?? "X media processing failed.",
                false,
              );
            }
            if (status.status === "PROCESSING") processing = true;
          }
          if (processing) {
            const count = job.pollingAttemptCount + 1;
            if (count >= MAX_POLLS) {
              throw new XProviderError("MEDIA_FAILED", "X media processing timed out.", false);
            }
            const pollAt = nextPoll(count);
            await prisma.publishingJob.update({
              where: { id: job.id },
              data: { status: "QUEUED", pollingAttemptCount: count, nextPollAt: pollAt },
            });
            return { state: "PROCESSING", nextPollAt: pollAt };
          }
          state.mediaReady = true;
        }
        for (let index = state.postIds.length; index < settings.posts.length; index += 1) {
          try {
            const created = await adapter.createPost({
              accessToken: tokens.accessToken,
              text: settings.posts[index]!,
              mediaIds: index === 0 ? state.mediaIds : undefined,
              replyToId: index === 0 ? settings.replyToId : state.postIds[index - 1],
            });
            state.postIds.push(created);
            await prisma.publishingJob.update({
              where: { id: job.id },
              data: {
                providerUploadState: state,
                providerStatus:
                  state.postIds.length === settings.posts.length
                    ? "PUBLISHED"
                    : "PARTIALLY_PUBLISHED",
              },
            });
          } catch (error) {
            if (state.postIds.length) {
              await attempt(
                job.id,
                "PARTIALLY_COMPLETED",
                { postIds: state.postIds },
                String(error),
              );
              await prisma.publishingJob.update({
                where: { id: job.id },
                data: {
                  status: "PARTIALLY_COMPLETED",
                  providerUploadState: state,
                  lastProviderError: error instanceof Error ? error.message : "Thread failed",
                },
              });
              return { state: "PARTIALLY_PUBLISHED", postIds: state.postIds };
            }
            throw error;
          }
        }
        postId = state.postIds[0]!;
        permalink = `https://x.com/i/web/status/${postId}`;
      }

      await prisma.publishingJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          providerStatus: "PUBLISHED",
          publishedMediaId: postId,
          permalink,
        },
      });
      await attempt(job.id, "COMPLETED", { postId, permalink });
      await prisma.contentSchedule.update({
        where: { id: schedule.id },
        data: { status: "COMPLETED" },
      });
      await prisma.contentItem.update({
        where: { id: schedule.contentItemId },
        data: { status: "PUBLISHED" },
      });
      return { state: "PUBLISHED", postId, permalink };
    } catch (error) {
      const quota =
        (error instanceof YouTubeProviderError && error.code === "QUOTA_EXHAUSTED") ||
        (error instanceof XProviderError &&
          ["RATE_LIMITED", "ENTITLEMENT_MISSING"].includes(error.code));
      const tokenExpired =
        (error instanceof YouTubeProviderError || error instanceof XProviderError) &&
        error.code === "TOKEN_EXPIRED";
      if (tokenExpired && job.refreshAttemptCount < 1) {
        try {
          const refreshed =
            settings.provider === "YOUTUBE"
              ? await youtubeCredentialAdapter.refreshAccessToken(tokens.refreshToken ?? "")
              : await xCredentialAdapter.refreshAccessToken(tokens.refreshToken ?? "");
          await socialCredentialService.upsertTokens(
            schedule.socialAccount.socialConnectionId,
            refreshed,
          );
          await prisma.publishingJob.update({
            where: { id: job.id },
            data: {
              status: "QUEUED",
              refreshAttemptCount: { increment: 1 },
              lastProviderError: error.message,
            },
          });
          return { state: "REQUEUED_AFTER_REFRESH" };
        } catch {
          // Falls through to terminal/manual fallback.
        }
      }
      const retryable =
        (error instanceof YouTubeProviderError || error instanceof XProviderError) &&
        error.retryable &&
        !quota &&
        job.attemptCount + 1 < job.maxAttempts;
      await attempt(
        job.id,
        quota ? "MANUAL_FALLBACK_REQUIRED" : retryable ? "RETRYING" : "FAILED",
        undefined,
        error instanceof Error ? error.message : "Provider failure",
      );
      await prisma.publishingJob.update({
        where: { id: job.id },
        data: {
          status: retryable ? "QUEUED" : "FAILED",
          directPublishAvailable: !quota,
          lastProviderError: error instanceof Error ? error.message : "Provider failure",
        },
      });
      return quota
        ? { state: "MANUAL_FALLBACK_REQUIRED" }
        : retryable
          ? { state: "RETRYING" }
          : { state: "FAILED" };
    }
  },
};
