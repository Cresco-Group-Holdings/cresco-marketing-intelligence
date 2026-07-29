import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { InstagramPublishingAdapter } from "@/lib/social/instagram-publishing-adapter";
import { createObjectStorageProvider } from "@/lib/storage/supabase-storage-provider";
import { socialCredentialService } from "@/server/services/social-credential-service";

export const instagramPublishingService = {
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
      await prisma.publishingAttempt.create({ data: { publishingJobId: job.id, attemptNumber: job.attemptCount + 1, status: "FAILED", errorMessage: error instanceof Error ? error.message : "Publish failed" } });
      await prisma.publishingJob.update({ where: { id: job.id }, data: { status: "FAILED" } });
      throw error;
    }
  },
};
