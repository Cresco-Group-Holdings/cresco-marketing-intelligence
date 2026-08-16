import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { processPublicationPublishingJob } from "@/server/services/publication-publishing-worker";
import type { WorkerHandler } from "@/lib/workers/types";

async function ensurePublishingJob(publicationId: string, organisationId: string) {
  const publication = await prisma.publication.findFirst({
    where: { id: publicationId, organisationId },
  });
  if (!publication) {
    throw new AppError("NOT_FOUND", "Publication not found for tenant.");
  }

  if (publication.status === "SCHEDULED") {
    await prisma.publication.update({
      where: { id: publication.id },
      data: { status: "QUEUED" },
    });
  }

  const idempotencyKey = `publication:${publication.id}:execute`;
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

export const publishingWorkerHandler: WorkerHandler = async (input) => {
  if (input.domainRefType !== "publication") {
    return { outcome: "failed", errorCategory: "CONFIGURATION_ERROR", safeMessage: "Invalid domain reference." };
  }

  const publication = await prisma.publication.findFirst({
    where: { id: input.domainRefId, organisationId: input.organisationId },
  });
  if (!publication) {
    return { outcome: "failed", errorCategory: "NON_RETRYABLE", safeMessage: "Publication tenant mismatch." };
  }

  const publishingJob = await ensurePublishingJob(publication.id, input.organisationId);
  const result = await processPublicationPublishingJob(publishingJob.id);

  if (!result) {
    return { outcome: "skipped", reason: "Publishing job not executable." };
  }

  switch (result.state) {
    case "PUBLISHED":
    case "DUPLICATE":
      return { outcome: "success" };
    case "SKIPPED":
      return { outcome: "skipped", reason: result.reason };
    case "REAUTH_REQUIRED":
      return {
        outcome: "failed",
        errorCategory: "REAUTH_REQUIRED",
        safeMessage: result.reason,
      };
    case "FAILED":
      return {
        outcome: "retry",
        errorCategory: result.category === "REAUTH_REQUIRED" ? "REAUTH_REQUIRED" : "RETRYABLE",
        safeMessage: result.reason,
      };
    default:
      return { outcome: "success" };
  }
};
