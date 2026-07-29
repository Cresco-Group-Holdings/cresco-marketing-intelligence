import type { PublishingJob } from "@prisma/client";
import { sanitiseEmailBody } from "@/lib/notifications/email-security";
import { getOrganisationNotifierUserIds } from "@/lib/notifications/recipients";
import { notificationEventService } from "@/server/services/notification-event-service";

export async function notifyPublishingFailed(
  job: PublishingJob,
  provider: string,
  reason: string,
): Promise<void> {
  const recipientUserIds = await getOrganisationNotifierUserIds(job.organisationId);
  if (recipientUserIds.length === 0) return;

  await notificationEventService.publishingFailed({
    organisationId: job.organisationId,
    projectId: job.projectId,
    brandId: job.brandId,
    jobId: job.id,
    provider,
    safeError: sanitiseEmailBody(reason),
    recipientUserIds,
    idempotencyKey: `publishing-failed:${job.id}:${job.attemptCount}`,
  });
}

export async function notifyPublishingSucceeded(job: PublishingJob): Promise<void> {
  const recipientUserIds = await getOrganisationNotifierUserIds(job.organisationId);
  if (recipientUserIds.length === 0) return;

  await notificationEventService.publishingSucceeded({
    organisationId: job.organisationId,
    projectId: job.projectId,
    brandId: job.brandId,
    jobId: job.id,
    recipientUserIds,
    idempotencyKey: `publishing-succeeded:${job.id}`,
  });
}
