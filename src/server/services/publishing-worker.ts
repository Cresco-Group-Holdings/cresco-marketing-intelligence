import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { instagramPublishingService } from "@/server/services/instagram-publishing-service";
import { tikTokPublishingService } from "@/server/services/tiktok-publishing-service";
import { linkedInFacebookPublishingService } from "@/server/services/linkedin-facebook-publishing-service";
import { youtubeXPublishingService } from "@/server/services/youtube-x-publishing-service";
import { processPublicationPublishingJob } from "@/server/services/publication-publishing-worker";

/** Routes a durable publishing job to the canonical publication worker or legacy provider service. */
export async function processPublishingJob(jobId: string) {
  const job = await prisma.publishingJob.findUnique({
    where: { id: jobId },
    select: {
      publicationId: true,
      schedule: { select: { contentVariant: { select: { provider: true } } } },
    },
  });
  if (!job) return null;

  if (job.publicationId) {
    return processPublicationPublishingJob(jobId);
  }

  if (!job.schedule) {
    throw new AppError("VALIDATION_ERROR", "Publishing job has no publication or schedule.");
  }

  const provider = job.schedule.contentVariant.provider;
  switch (provider) {
    case "INSTAGRAM":
      return instagramPublishingService.process(jobId);
    case "TIKTOK":
      return tikTokPublishingService.process(jobId);
    case "LINKEDIN":
    case "FACEBOOK":
      return linkedInFacebookPublishingService.process(jobId);
    case "YOUTUBE":
    case "X":
      return youtubeXPublishingService.process(jobId);
    default:
      throw new AppError("VALIDATION_ERROR", `Publishing is not implemented for ${provider}.`);
  }
}
