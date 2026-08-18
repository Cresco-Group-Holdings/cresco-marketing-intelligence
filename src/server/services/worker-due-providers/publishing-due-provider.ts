import { prisma } from "@/lib/database/prisma";
import { publishingJobIdempotencyKey } from "@/lib/workers/idempotency";
import type { DueWorkItem } from "@/lib/workers/types";

export async function discoverPublishingDueWork(now: Date, limit: number): Promise<DueWorkItem[]> {
  const publications = await prisma.publication.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: { lte: now },
      cancelledAt: null,
      organisation: { status: "ACTIVE", archivedAt: null },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
    select: {
      id: true,
      organisationId: true,
      scheduledFor: true,
    },
  });

  return publications.map((publication) => ({
    organisationId: publication.organisationId,
    jobType: "PUBLISHING",
    domainRefType: "publication",
    domainRefId: publication.id,
    idempotencyKey: publishingJobIdempotencyKey(publication.id),
    dueAt: publication.scheduledFor ?? now,
    payload: { publicationId: publication.id },
  }));
}
