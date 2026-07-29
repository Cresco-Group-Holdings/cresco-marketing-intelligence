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
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { socialCredentialService } from "@/server/services/social-credential-service";
import { brandService } from "@/server/services/workspace-service";

type ProviderSettings =
  | { provider: "LINKEDIN"; authorType: "MEMBER" | "ORGANISATION"; authorId: string }
  | { provider: "FACEBOOK"; pageId: string; publishAsReel: boolean };

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
    if (job.publishedMediaId) return { state: "ALREADY_PUBLISHED", postId: job.publishedMediaId };
    const settings = job.providerSettings as ProviderSettings | null;
    if (!settings)
      throw new AppError("VALIDATION_ERROR", "Provider publishing settings are missing.");
    const { schedule } = job;
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
          postId = await adapter.publishVideo({
            pageId: settings.pageId,
            accessToken: tokens.accessToken,
            description: message,
            fileUrl: urls[0]!,
            reel: settings.publishAsReel,
          });
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
        let media: { kind: LinkedInMediaKind; assetUrn: string; title?: string } | undefined;
        if (assets[0]) {
          const asset = assets[0];
          const kind: LinkedInMediaKind =
            asset.assetType === "VIDEO"
              ? "VIDEO"
              : asset.assetType === "DOCUMENT"
                ? "DOCUMENT"
                : "IMAGE";
          const upload = await adapter.initialiseUpload(kind, authorUrn, tokens.accessToken);
          if (!upload.uploadUrl || !upload.assetUrn) {
            throw new LinkedInProviderError(
              "UPLOAD_FAILED",
              "LinkedIn did not return an upload target.",
              true,
            );
          }
          await prisma.publishingJob.update({
            where: { id: job.id },
            data: { providerContainerId: upload.assetUrn, providerStatus: "UPLOADING" },
          });
          const signed = await storage.createSignedUrl(asset.storageKey, 3600);
          await adapter.uploadAsset(upload.uploadUrl, signed.url, tokens.accessToken);
          media = { kind, assetUrn: upload.assetUrn, title: asset.title };
        }
        postId = await adapter.createPost({
          authorUrn,
          commentary: schedule.contentVariant.caption ?? "",
          accessToken: tokens.accessToken,
          media,
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
