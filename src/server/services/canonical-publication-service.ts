import type { PublicationOperationType } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { incrementPublishingCounter } from "@/lib/publishing/observability";
import {
  assertPublicationTransition,
  isPublicationExecutable,
} from "@/lib/publishing/publication-lifecycle";
import { canCancelPublication, canRetryPublication } from "@/lib/publishing/publication-governance";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { calendarProjectionService } from "@/server/services/calendar-projection-service";
import { processPublicationPublishingJob } from "@/server/services/publication-publishing-worker";
import {
  publicationService,
  type CreatePublicationInput,
} from "@/server/services/publication-service";

function publicationJobIdempotencyKey(publicationId: string, suffix = "execute"): string {
  return `publication:${publicationId}:${suffix}`;
}

async function createPublishingJobForPublication(
  publication: {
    id: string;
    organisationId: string;
    projectId: string;
    brandId: string;
    status: string;
  },
  idempotencySuffix = "execute",
) {
  const idempotencyKey = publicationJobIdempotencyKey(publication.id, idempotencySuffix);
  const existing = await prisma.publishingJob.findFirst({
    where: { publicationId: publication.id, idempotencyKey },
  });
  if (existing) return existing;

  return prisma.publishingJob.create({
    data: {
      organisationId: publication.organisationId,
      projectId: publication.projectId,
      brandId: publication.brandId,
      publicationId: publication.id,
      idempotencyKey,
      status: "QUEUED",
    },
  });
}

export const canonicalPublicationService = {
  async createPublication(
    brandId: string,
    organisationId: string,
    input: CreatePublicationInput,
    context: TenantContext,
    requestId?: string,
  ) {
    return publicationService.create(brandId, organisationId, input, context, requestId);
  },

  async publishNow(
    brandId: string,
    organisationId: string,
    input: CreatePublicationInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const { publication, governance } = await publicationService.create(
      brandId,
      organisationId,
      { ...input, scheduledFor: undefined, humanApprovalRequired: false, publicationApproved: true },
      context,
      requestId,
    );

    if (governance.blockers.length > 0) {
      throw new AppError("VALIDATION_ERROR", governance.blockers.join(" "));
    }

    let row = await prisma.publication.findFirst({
      where: { id: publication.id, organisationId, brandId },
    });
    if (!row) throw new AppError("NOT_FOUND", "Publication not found.");

    if (row.status === "PENDING_APPROVAL") {
      row = await prisma.publication.update({
        where: { id: row.id },
        data: { status: "APPROVED", approvedAt: new Date(), approvedByUserId: context.userProfileId },
      });
    }

    assertPublicationTransition(row.status, "QUEUED");
    row = await prisma.publication.update({
      where: { id: row.id },
      data: { status: "QUEUED" },
    });

    const job = await createPublishingJobForPublication(row);
    incrementPublishingCounter("publishing.scheduled_jobs_enqueued", 1, {
      publicationId: row.id,
      providerKey: row.providerKey,
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "publication.queued",
      resourceType: "publication",
      resourceId: row.id,
      requestId,
    });

    const result = await processPublicationPublishingJob(job.id, context);
    return { publication: row, job, result };
  },

  async schedulePublication(
    brandId: string,
    organisationId: string,
    input: CreatePublicationInput & { scheduledFor: string },
    context: TenantContext,
    requestId?: string,
  ) {
    const { publication, governance } = await publicationService.create(
      brandId,
      organisationId,
      {
        ...input,
        operationType: (input.operationType ?? "SOCIAL_SCHEDULE_POST") as PublicationOperationType,
        humanApprovalRequired: false,
        publicationApproved: true,
      },
      context,
      requestId,
    );

    if (governance.blockers.length > 0) {
      throw new AppError("VALIDATION_ERROR", governance.blockers.join(" "));
    }

    let row = await prisma.publication.findFirst({
      where: { id: publication.id, organisationId, brandId },
    });
    if (!row) throw new AppError("NOT_FOUND", "Publication not found.");

    if (row.status === "PENDING_APPROVAL") {
      row = await prisma.publication.update({
        where: { id: row.id },
        data: { status: "SCHEDULED", approvedAt: new Date(), approvedByUserId: context.userProfileId },
      });
    } else if (row.status !== "SCHEDULED") {
      assertPublicationTransition(row.status, "SCHEDULED");
      row = await prisma.publication.update({
        where: { id: row.id },
        data: { status: "SCHEDULED" },
      });
    }

    await calendarProjectionService.syncPublication(row.id);

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "publication.scheduled",
      resourceType: "publication",
      resourceId: row.id,
      requestId,
      metadata: { scheduledFor: input.scheduledFor },
    });

    return { publication: row };
  },

  async cancelPublication(
    brandId: string,
    organisationId: string,
    publicationId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const publication = await prisma.publication.findFirst({
      where: { id: publicationId, organisationId, brandId },
    });
    if (!publication) throw new AppError("NOT_FOUND", "Publication not found.");
    if (!canCancelPublication(publication.status)) {
      throw new AppError("VALIDATION_ERROR", "Publication cannot be cancelled.");
    }

    assertPublicationTransition(publication.status, "CANCELLED");
    const updated = await prisma.publication.update({
      where: { id: publicationId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    await prisma.publishingJob.updateMany({
      where: { publicationId, status: { in: ["QUEUED", "PROCESSING"] } },
      data: { status: "CANCELLED" },
    });

    await calendarProjectionService.syncPublication(publicationId);

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "publication.cancelled",
      resourceType: "publication",
      resourceId: publicationId,
      requestId,
    });

    return updated;
  },

  async reschedulePublication(
    brandId: string,
    organisationId: string,
    publicationId: string,
    input: { scheduledFor: string; timezone?: string },
    context: TenantContext,
    requestId?: string,
  ) {
    const publication = await prisma.publication.findFirst({
      where: { id: publicationId, organisationId, brandId },
    });
    if (!publication) throw new AppError("NOT_FOUND", "Publication not found.");
    if (publication.status !== "SCHEDULED") {
      throw new AppError("VALIDATION_ERROR", "Only scheduled publications can be rescheduled.");
    }

    const scheduledFor = new Date(input.scheduledFor);
    if (scheduledFor <= new Date()) {
      throw new AppError("VALIDATION_ERROR", "Scheduled time must be in the future.");
    }

    const updated = await prisma.publication.update({
      where: { id: publicationId },
      data: {
        scheduledFor,
        timezone: input.timezone ?? publication.timezone,
      },
    });

    await calendarProjectionService.syncPublication(publicationId);

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "publication.rescheduled",
      resourceType: "publication",
      resourceId: publicationId,
      requestId,
      metadata: { scheduledFor: input.scheduledFor },
    });

    return updated;
  },

  async retryPublication(
    brandId: string,
    organisationId: string,
    publicationId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const publication = await prisma.publication.findFirst({
      where: { id: publicationId, organisationId, brandId },
    });
    if (!publication) throw new AppError("NOT_FOUND", "Publication not found.");
    if (!canRetryPublication(publication.status)) {
      throw new AppError("VALIDATION_ERROR", "Publication cannot be retried.");
    }

    assertPublicationTransition(publication.status, "QUEUED");
    const updated = await prisma.publication.update({
      where: { id: publicationId },
      data: { status: "QUEUED", lastErrorCode: null, lastErrorMessage: null },
    });

    const job = await createPublishingJobForPublication(
      updated,
      `retry-${Date.now()}`,
    );

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "publication.retried",
      resourceType: "publication",
      resourceId: publicationId,
      requestId,
    });

    const result = await processPublicationPublishingJob(job.id, context);
    return { publication: updated, job, result };
  },

  async getPublicationStatus(
    brandId: string,
    organisationId: string,
    publicationId: string,
    context: TenantContext,
  ) {
    return publicationService.get(brandId, organisationId, publicationId, context);
  },

  async enqueueDueScheduledPublications(now = new Date()) {
    const due = await prisma.publication.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: { lte: now },
        cancelledAt: null,
      },
      orderBy: { scheduledFor: "asc" },
      take: 50,
    });

    const enqueued: string[] = [];
    for (const publication of due) {
      const updated = await prisma.publication.update({
        where: { id: publication.id },
        data: { status: "QUEUED" },
      });
      await createPublishingJobForPublication(updated, `due-${publication.scheduledFor?.toISOString()}`);
      enqueued.push(publication.id);
    }
    return enqueued;
  },

  isExecutable: isPublicationExecutable,
};
