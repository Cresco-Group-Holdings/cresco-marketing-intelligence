import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { InstagramPublishingAdapter } from "@/lib/social/instagram-publishing-adapter";
import { createObjectStorageProvider } from "@/lib/storage/supabase-storage-provider";
import { socialCredentialService } from "@/server/services/social-credential-service";
import { socialAdapterFactory } from "@/lib/social/adapters/mock-social-adapter";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const instagramPublishingService = {
  async enqueueImmediatePublish(
    brandId: string,
    organisationId: string,
    contentId: string,
    input: { contentVariantId: string; socialAccountId: string; idempotencyKey: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const existingJob = await prisma.publishingJob.findFirst({
      where: { organisationId, idempotencyKey: input.idempotencyKey },
    });
    if (existingJob) return existingJob;
    const content = await prisma.contentItem.findFirst({
      where: { id: contentId, organisationId, brandId, status: "APPROVED", archivedAt: null },
      include: { variants: true },
    });
    if (!content) throw new AppError("VALIDATION_ERROR", "Only approved content can be published immediately.");
    const variant = content.variants.find((item) => item.id === input.contentVariantId);
    if (!variant || variant.provider !== "INSTAGRAM" || variant.socialAccountId !== input.socialAccountId) {
      throw new AppError("VALIDATION_ERROR", "Confirm the assigned Instagram account and variant.");
    }
    const account = await prisma.socialAccount.findFirst({
      where: { id: input.socialAccountId, organisationId, brandId, provider: "INSTAGRAM", status: "CONNECTED", socialConnection: { status: "CONNECTED" } },
    });
    if (!account) throw new AppError("VALIDATION_ERROR", "Instagram account is not connected.");
    const schedule = await prisma.contentSchedule.create({
      data: { organisationId, projectId: brand.projectId, brandId, contentItemId: content.id, contentVariantId: variant.id, socialAccountId: account.id, scheduledFor: new Date(), timezone: "UTC", status: "QUEUED", createdByUserId: context.userProfileId },
    });
    return prisma.publishingJob.upsert({
      where: { contentScheduleId_idempotencyKey: { contentScheduleId: schedule.id, idempotencyKey: input.idempotencyKey } },
      create: { organisationId, projectId: brand.projectId, brandId, contentScheduleId: schedule.id, idempotencyKey: input.idempotencyKey, status: "QUEUED" },
      update: {},
    });
  },
  async process(jobId: string) {
    const job = await prisma.publishingJob.findFirst({ where: { id: jobId, status: "QUEUED" }, include: { schedule: { include: { contentVariant: { include: { visualAssets: { include: { marketingAsset: true } } } }, socialAccount: { include: { socialConnection: true } } } } } });
    if (!job) return null;
    const { schedule } = job;
    if (schedule.contentVariant.provider !== "INSTAGRAM" || !schedule.contentVariant.socialAccountId) throw new AppError("VALIDATION_ERROR", "Only assigned Instagram variants can publish.");
    const assets = schedule.contentVariant.visualAssets.map((item) => item.marketingAsset).filter((asset) => asset.status === "READY" && asset.approvedForMarketing && (!asset.licenceExpiresAt || asset.licenceExpiresAt > new Date()));
    if (!assets.length) throw new AppError("VALIDATION_ERROR", "Instagram publishing requires approved, unexpired media.");
    const tokens = await socialCredentialService.readTokens(schedule.socialAccount.socialConnectionId);
    if (!tokens) throw new AppError("VALIDATION_ERROR", "Instagram credentials are unavailable.");
    await prisma.publishingJob.update({ where: { id: job.id }, data: { status: "PROCESSING", attemptCount: { increment: 1 } } });
    try {
      const storage = createObjectStorageProvider();
      const urls = await Promise.all(assets.map((asset) => storage.createSignedUrl(asset.storageKey, 3600).then((signed) => signed.url)));
      const result = await new InstagramPublishingAdapter().publish({ igUserId: schedule.socialAccount.providerAccountId, accessToken: tokens.accessToken, caption: schedule.contentVariant.caption ?? undefined, altText: schedule.contentVariant.altText ?? undefined, mediaUrls: urls, mediaType: assets.some((asset) => asset.assetType === "VIDEO") ? "REELS" : assets.length > 1 ? "CAROUSEL" : "IMAGE" });
      await prisma.publishingAttempt.create({ data: { publishingJobId: job.id, attemptNumber: job.attemptCount + 1, status: "COMPLETED", providerResponse: result } });
      await prisma.publishingJob.update({ where: { id: job.id }, data: { status: "COMPLETED" } });
      await prisma.contentSchedule.update({ where: { id: schedule.id }, data: { status: "COMPLETED" } });
      return result;
    } catch (error) {
      if (
        error instanceof AppError &&
        /token expired|token.*invalid/i.test(error.message) &&
        tokens.refreshToken
      ) {
        const adapter = socialAdapterFactory.getAdapter("INSTAGRAM");
        if (adapter) {
          const refreshed = await adapter.refreshAccessToken({ refreshToken: tokens.refreshToken });
          await socialCredentialService.upsertTokens(schedule.socialAccount.socialConnectionId, refreshed);
          await prisma.publishingJob.update({ where: { id: job.id }, data: { status: "QUEUED" } });
          return { retried: true, reason: "credentials_refreshed" };
        }
      }
      await prisma.publishingAttempt.create({ data: { publishingJobId: job.id, attemptNumber: job.attemptCount + 1, status: "FAILED", errorMessage: error instanceof Error ? error.message : "Publish failed" } });
      await prisma.publishingJob.update({ where: { id: job.id }, data: { status: "FAILED" } });
      throw error;
    }
  },
};
