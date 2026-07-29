import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { instagramPublishingService } from "@/server/services/instagram-publishing-service";
import { tikTokPublishingService } from "@/server/services/tiktok-publishing-service";
import { linkedInFacebookPublishingService } from "@/server/services/linkedin-facebook-publishing-service";

/** Routes a durable publishing job to the adapter that owns its provider. */
export async function processPublishingJob(jobId: string) {
  const job = await prisma.publishingJob.findUnique({
    where: { id: jobId },
    select: { schedule: { select: { contentVariant: { select: { provider: true } } } } },
  });
  if (!job) return null;

  const provider = job.schedule.contentVariant.provider;
  switch (provider) {
    case "INSTAGRAM":
      return instagramPublishingService.process(jobId);
    case "TIKTOK":
      return tikTokPublishingService.process(jobId);
    case "LINKEDIN":
    case "FACEBOOK":
      return linkedInFacebookPublishingService.process(jobId);
    default:
      throw new AppError("VALIDATION_ERROR", `Publishing is not implemented for ${provider}.`);
  }
}
