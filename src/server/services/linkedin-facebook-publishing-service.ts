import type { Prisma, SocialProvider } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  FacebookProviderError,
  FacebookPublishingAdapter,
} from "@/lib/social/facebook-publishing-adapter";
import {
  LinkedInProviderError,
  LinkedInPublishingAdapter,
  type LinkedInMediaKind,
} from "@/lib/social/linkedin-publishing-adapter";
import { createObjectStorageProvider } from "@/lib/storage/supabase-storage-provider";
import { linkedInCredentialAdapter } from "@/lib/social/linkedin-credential-adapter";
import { metaCredentialAdapter } from "@/lib/social/meta-credential-adapter";
import type { TenantContext } from "@/lib/tenancy/context";
import { assertAccountPublishingCapability } from "@/lib/publishing/capabilities";
import { isProviderPublishingDisabled } from "@/lib/publishing/config";
import { recordAuditEvent } from "@/server/services/audit-service";
import { socialCredentialService } from "@/server/services/social-credential-service";
import { hasPublishingSchedule, nullToUndefined, resolveContentScheduleId } from "@/lib/publishing/schedule";
import { brandService } from "@/server/services/workspace-service";

type ProviderSettings =
  | { provider: "LINKEDIN"; authorType: "MEMBER" | "ORGANISATION"; authorId: string }
  | { provider: "FACEBOOK"; pageId: string; publishAsReel: boolean };

type UploadState = {
  assetId: string;
  kind: LinkedInMediaKind;
  assetUrn: string;
  status: "UPLOADED" | "PROCESSING" | "AVAILABLE" | "FAILED" | "EXPIRED";
};

const MAX_PROVIDER_POLLS = 12;
const nextPollAt = (attempt: number) => new Date(Date.now() + 5_000 * 2 ** Math.min(attempt, 5));

function requiredScope(settings: ProviderSettings) {
  if (settings.provider === "FACEBOOK") return "pages_manage_posts";
  return settings.authorType === "ORGANISATION" ? "w_organization_social" : "w_member_social";
}

async function recordAttempt(
  jobId: string,
  status: string,
  response?: unknown,
  errorMessage?: string,
) {
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
      errorMessage,
    },
  });
}

export const linkedInFacebookPublishingService = {
  async enqueue(
    brandId: string,
    organisationId: string,
    contentId: string,
    input: {
      contentVariantId: string;
      socialAccountId: string;
      idempotencyKey: string;
      settings: ProviderSettings;
    },
    context: TenantContext,
    requestId?: string,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    if (isProviderPublishingDisabled(input.settings.provider)) {
      throw new AppError(
        "FORBIDDEN",
        `${input.settings.provider} publishing is temporarily disabled by an operator.`,
      );
    }
    const existing = await prisma.publishingJob.findFirst({
      where: { organisationId, brandId, idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;

    const content = await prisma.contentItem.findFirst({
      where: { id: contentId, organisationId, brandId, status: "APPROVED", archivedAt: null },
    });
    if (!content) throw new AppError("VALIDATION_ERROR", "Only approved content can be published.");

    const variant = await prisma.contentVariant.findFirst({
      where: {
        id: input.contentVariantId,
        contentItemId: content.id,
        organisationId,
        brandId,
        provider: input.settings.provider,
        socialAccountId: input.socialAccountId,
      },
      include: { visualAssets: { include: { marketingAsset: true } } },
    });
    if (!variant)
      throw new AppError("VALIDATION_ERROR", "Confirm the selected platform variant and account.");
    if (Array.isArray(variant.validationErrors) && variant.validationErrors.length) {
      throw new AppError("VALIDATION_ERROR", "The platform variant has validation errors.");
    }

    const account = await prisma.socialAccount.findFirst({
      where: {
        id: input.socialAccountId,
        organisationId,
        brandId,
        provider: input.settings.provider,
        status: "CONNECTED",
        socialConnection: { status: "CONNECTED" },
      },
      include: { socialConnection: true },
    });
    if (!account)
      throw new AppError("VALIDATION_ERROR", "The selected platform account is not connected.");
    await assertAccountPublishingCapability(account.id, variant.format);
    if (!account.socialConnection.grantedScopes.includes(requiredScope(input.settings))) {
      throw new AppError(
        "FORBIDDEN",
        `Missing required permission: ${requiredScope(input.settings)}.`,
      );
    }

    if (input.settings.provider === "LINKEDIN") {
      const expectedType =
        input.settings.authorType === "MEMBER" ? "LINKEDIN_MEMBER" : "LINKEDIN_ORGANISATION";
      if (
        account.accountType !== expectedType ||
        account.providerAccountId !== input.settings.authorId
      ) {
        throw new AppError(
          "FORBIDDEN",
          "The selected LinkedIn author is not owned by this connection.",
        );
      }
    } else if (
      account.accountType !== "FACEBOOK_PAGE" ||
      account.providerAccountId !== input.settings.pageId
    ) {
      throw new AppError(
        "FORBIDDEN",
        "The selected Facebook Page is not owned by this connection.",
      );
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
          "All attached assets must be ready, approved, and licensed.",
        );
      }
      if (
        input.settings.provider === "LINKEDIN" &&
        asset.assetType === "DOCUMENT" &&
        asset.mimeType !== "application/pdf"
      ) {
        throw new AppError(
          "VALIDATION_ERROR",
          "LinkedIn document posts support PDF assets in this implementation.",
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
        providerSettings: input.settings,
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
      metadata: input.settings,
    });
    return job;
  },

  async process(jobId: string) {
    const job = await prisma.publishingJob.findFirst({
      where: { id: jobId, status: { in: ["QUEUED", "PROCESSING"] } },
      include: {
        schedule: {
          include: {
            contentItem: true,
            contentVariant: { include: { visualAssets: { include: { marketingAsset: true } } } },
            socialAccount: { include: { socialConnection: true } },
          },
        },
      },
    });
    if (!job) return null;
    if (!job.schedule) return null;
    if (job.publishedMediaId) return { state: "ALREADY_PUBLISHED", postId: job.publishedMediaId };
    const settings = job.providerSettings as ProviderSettings | null;
    if (!settings)
      throw new AppError("VALIDATION_ERROR", "Provider publishing settings are missing.");
    if (!hasPublishingSchedule(job)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Publishing job requires a content schedule for legacy provider execution.",
      );
    }
    const schedule = job.schedule;
    if (
      schedule.organisationId !== job.organisationId ||
      schedule.brandId !== job.brandId ||
      schedule.socialAccount.organisationId !== job.organisationId
    ) {
      throw new AppError("FORBIDDEN", "Publishing job references another tenant.");
    }
    if (!["APPROVED", "SCHEDULED"].includes(schedule.contentItem.status)) {
      throw new AppError("VALIDATION_ERROR", "Only approved content can be published.");
    }
    const tokens = await socialCredentialService.readTokens(
      schedule.socialAccount.socialConnectionId,
    );
    if (!tokens) throw new AppError("VALIDATION_ERROR", "Provider credentials are unavailable.");

    await prisma.publishingJob.update({
      where: { id: job.id },
      data: { status: "PROCESSING", attemptCount: { increment: 1 } },
    });
    try {
      let postId: string | null;
      let permalink: string | null = null;
      const assets = schedule.contentVariant.visualAssets.map((entry) => entry.marketingAsset);
      const storage = createObjectStorageProvider();

      if (settings.provider === "FACEBOOK") {
        const adapter = new FacebookPublishingAdapter();
        const urls = await Promise.all(
          assets.map((asset) =>
            storage.createSignedUrl(asset.storageKey, 3600).then((value) => value.url),
          ),
        );
        const message = schedule.contentVariant.caption ?? "";
        if (assets.length === 0) {
          postId = await adapter.publishTextOrLink({
            pageId: settings.pageId,
            accessToken: tokens.accessToken,
            message,
            link: schedule.contentVariant.destinationUrl ?? undefined,
          });
        } else if (assets.some((asset) => asset.assetType === "VIDEO")) {
          let videoId = job.providerContainerId;
          if (!videoId) {
            videoId = await adapter.publishVideo({
              pageId: settings.pageId,
              accessToken: tokens.accessToken,
              description: message,
              fileUrl: urls[0]!,
              reel: settings.publishAsReel,
            });
            await prisma.publishingJob.update({
              where: { id: job.id },
              data: {
                providerContainerId: videoId,
                providerStatus: "PROCESSING",
                providerUploadState: {
                  kind: settings.publishAsReel ? "REEL" : "VIDEO",
                  uploadId: videoId,
                },
              },
            });
          }
          const state = await adapter.getVideoStatus(videoId, tokens.accessToken);
          const pollingAttemptCount = job.pollingAttemptCount + 1;
          if (state.status === "FAILED" || state.status === "EXPIRED") {
            throw new FacebookProviderError(
              "UPLOAD_FAILED",
              `Facebook ${settings.publishAsReel ? "Reel" : "video"} processing ${state.status.toLowerCase()}.`,
              false,
            );
          }
          if (state.status === "PROCESSING") {
            if (pollingAttemptCount >= MAX_PROVIDER_POLLS) {
              throw new FacebookProviderError(
                "UPLOAD_FAILED",
                "Facebook video processing timed out.",
                false,
              );
            }
            const pollAt = nextPollAt(pollingAttemptCount);
            await prisma.publishingJob.update({
              where: { id: job.id },
              data: {
                status: "QUEUED",
                providerStatus: "PROCESSING",
                pollingAttemptCount,
                nextPollAt: pollAt,
              },
            });
            return { state: "PROCESSING", uploadId: videoId, nextPollAt: pollAt };
          }
          postId = state.postId ?? videoId;
        } else if (urls.length > 1) {
          postId = await adapter.publishMultiplePhotos({
            pageId: settings.pageId,
            accessToken: tokens.accessToken,
            message,
            urls,
          });
        } else {
          postId = await adapter.publishPhoto({
            pageId: settings.pageId,
            accessToken: tokens.accessToken,
            message,
            url: urls[0]!,
          });
        }
        permalink = await adapter.getPermalink(postId, tokens.accessToken);
      } else {
        const adapter = new LinkedInPublishingAdapter();
        const authorUrn =
          settings.authorType === "MEMBER"
            ? `urn:li:person:${settings.authorId}`
            : `urn:li:organization:${settings.authorId}`;
        const uploads = [...((job.providerUploadState as UploadState[] | null | undefined) ?? [])];
        for (const asset of assets) {
          const kind: LinkedInMediaKind =
            asset.assetType === "VIDEO"
              ? "VIDEO"
              : asset.assetType === "DOCUMENT"
                ? "DOCUMENT"
                : "IMAGE";
          let state = uploads.find((entry) => entry.assetId === asset.id);
          if (!state) {
            const upload = await adapter.initialiseUpload(kind, authorUrn, tokens.accessToken);
            if (!upload.uploadUrl || !upload.assetUrn) {
              throw new LinkedInProviderError(
                "UPLOAD_FAILED",
                "LinkedIn did not return an upload target.",
                true,
              );
            }
            const signed = await storage.createSignedUrl(asset.storageKey, 3600);
            await adapter.uploadAsset(upload.uploadUrl, signed.url, tokens.accessToken);
            state = {
              assetId: asset.id,
              kind,
              assetUrn: upload.assetUrn,
              status: kind === "IMAGE" ? "AVAILABLE" : "UPLOADED",
            };
            uploads.push(state);
            // Persist after every asset so partial multi-image retries resume in order.
            await prisma.publishingJob.update({
              where: { id: job.id },
              data: {
                providerContainerId: upload.assetUrn,
                providerStatus: state.status,
                providerUploadState: uploads as unknown as Prisma.InputJsonValue,
              },
            });
          }
        }

        let processing = false;
        for (const upload of uploads.filter((entry) => entry.kind !== "IMAGE")) {
          if (upload.status === "AVAILABLE") continue;
          const status = await adapter.getAssetStatus(
            upload.kind,
            upload.assetUrn,
            tokens.accessToken,
          );
          upload.status = status;
          if (status === "FAILED" || status === "EXPIRED") {
            throw new LinkedInProviderError(
              "PROCESSING_FAILED",
              `LinkedIn ${upload.kind.toLowerCase()} processing ${status.toLowerCase()}.`,
              false,
            );
          }
          if (status === "PROCESSING") processing = true;
        }
        if (processing) {
          const pollingAttemptCount = job.pollingAttemptCount + 1;
          if (pollingAttemptCount >= MAX_PROVIDER_POLLS) {
            throw new LinkedInProviderError(
              "PROCESSING_FAILED",
              "LinkedIn media processing timed out.",
              false,
            );
          }
          const pollAt = nextPollAt(pollingAttemptCount);
          await prisma.publishingJob.update({
            where: { id: job.id },
            data: {
              status: "QUEUED",
              providerStatus: "PROCESSING",
              providerUploadState: uploads as unknown as Prisma.InputJsonValue,
              pollingAttemptCount,
              nextPollAt: pollAt,
            },
          });
          return { state: "PROCESSING", nextPollAt: pollAt };
        }

        const images =
          uploads.length > 1 && uploads.every((entry) => entry.kind === "IMAGE")
            ? uploads.map((entry, index) => ({
                assetUrn: entry.assetUrn,
                altText:
                  schedule.contentVariant.visualAssets[index]?.altText ??
                  schedule.contentVariant.altText ??
                  undefined,
              }))
            : undefined;
        const first = uploads[0];
        const media =
          first && !images
            ? {
                kind: first.kind,
                assetUrn: first.assetUrn,
                title: assets[0]?.title,
              }
            : undefined;
        postId = await adapter.createPost({
          authorUrn,
          commentary: schedule.contentVariant.caption ?? "",
          accessToken: tokens.accessToken,
          media,
          images,
          ...(!media && schedule.contentVariant.destinationUrl
            ? {
                article: {
                  source: schedule.contentVariant.destinationUrl,
                  title: schedule.contentVariant.headline ?? undefined,
                  description: schedule.contentVariant.description ?? undefined,
                },
              }
            : {}),
        });
      }

      if (!postId)
        throw new AppError("INTERNAL_ERROR", "Provider did not return a post identifier.");
      await prisma.publishingJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          providerStatus: "PUBLISHED",
          publishedMediaId: postId,
          permalink,
        },
      });
      await recordAttempt(job.id, "COMPLETED", { postId, permalink });
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
      const tokenExpired =
        (error instanceof LinkedInProviderError || error instanceof FacebookProviderError) &&
        error.code === "TOKEN_EXPIRED";
      if (tokenExpired) {
        if (job.refreshAttemptCount >= 1) {
          await recordAttempt(
            job.id,
            "FAILED",
            undefined,
            "Provider credentials remain invalid after refresh. Reconnect the account.",
          );
          await prisma.publishingJob.update({
            where: { id: job.id },
            data: {
              status: "FAILED",
              lastProviderError:
                "Provider credentials remain invalid after refresh. Reconnect the account.",
            },
          });
          return { state: "FAILED" };
        }
        try {
          const refreshed =
            settings.provider === "LINKEDIN"
              ? await linkedInCredentialAdapter.refreshAccessToken(tokens.refreshToken ?? "")
              : await metaCredentialAdapter.refreshAccessToken({ accessToken: tokens.accessToken });
          await socialCredentialService.upsertTokens(
            schedule.socialAccount.socialConnectionId,
            settings.provider === "FACEBOOK"
              ? { ...refreshed, refreshToken: tokens.refreshToken }
              : refreshed,
          );
          await recordAttempt(job.id, "RETRY_AFTER_REFRESH", undefined, error.message);
          await prisma.publishingJob.update({
            where: { id: job.id },
            data: {
              status: "QUEUED",
              refreshAttemptCount: { increment: 1 },
              lastProviderError: error.message,
            },
          });
          return { state: "REQUEUED_AFTER_REFRESH" };
        } catch (refreshError) {
          const message =
            refreshError instanceof Error ? refreshError.message : "Credential refresh failed.";
          await recordAttempt(job.id, "FAILED", undefined, message);
          await prisma.publishingJob.update({
            where: { id: job.id },
            data: { status: "FAILED", lastProviderError: message },
          });
          return { state: "FAILED", reason: message };
        }
      }
      const retryable =
        (error instanceof LinkedInProviderError || error instanceof FacebookProviderError) &&
        error.retryable;
      await recordAttempt(
        job.id,
        retryable ? "RETRYING" : "FAILED",
        undefined,
        error instanceof Error ? error.message : "Provider failure",
      );
      await prisma.publishingJob.update({
        where: { id: job.id },
        data: {
          status: retryable && job.attemptCount + 1 < job.maxAttempts ? "QUEUED" : "FAILED",
          lastProviderError: error instanceof Error ? error.message : "Provider failure",
        },
      });
      if (!retryable) throw error;
      return { state: "RETRYING" };
    }
  },
};

export function providerForSettings(settings: ProviderSettings): SocialProvider {
  return settings.provider;
}
