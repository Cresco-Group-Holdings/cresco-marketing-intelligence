import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPublishingCounters, readPublishingCounters } from "@/lib/publishing/observability";

const prismaMock = vi.hoisted(() => ({
  publishingJob: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  publication: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

const publicationServiceMock = vi.hoisted(() => ({
  create: vi.fn(),
}));

const processWorkerMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/publication-service", () => ({
  publicationService: publicationServiceMock,
}));
vi.mock("@/server/services/publication-publishing-worker", () => ({
  processPublicationPublishingJob: processWorkerMock,
}));
vi.mock("@/server/services/audit-service", () => ({
  recordAuditEvent: vi.fn(),
}));

import { canonicalPublicationService } from "@/server/services/canonical-publication-service";

const tenant = {
  userId: "auth-user-1",
  userProfileId: "profile-1",
  organisationId: "org-1",
  organisationRole: "ADMIN" as const,
  projectId: "proj-1",
  brandId: "brand-1",
};

describe("canonicalPublicationService publishing counters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPublishingCounters();
    processWorkerMock.mockResolvedValue({ state: "PUBLISHED" });
    publicationServiceMock.create.mockResolvedValue({
      publication: { id: "pub-new", status: "APPROVED" },
      governance: { blockers: [] },
    });
    prismaMock.publication.findFirst.mockResolvedValue({
      id: "pub-new",
      organisationId: "org-1",
      brandId: "brand-1",
      projectId: "proj-1",
      providerKey: "mock-social",
      status: "APPROVED",
    });
    prismaMock.publication.update.mockResolvedValue({
      id: "pub-new",
      organisationId: "org-1",
      brandId: "brand-1",
      projectId: "proj-1",
      providerKey: "mock-social",
      status: "QUEUED",
    });
    prismaMock.publishingJob.findFirst.mockResolvedValue(null);
    prismaMock.publishingJob.create.mockResolvedValue({ id: "job-new" });
  });

  it("maps publishNow queue counter to scheduled_jobs_enqueued", async () => {
    await canonicalPublicationService.publishNow(
      "brand-1",
      "org-1",
      {
        contentItemId: "content-1",
        connectionId: "conn-1",
        externalAccountId: "acct-1",
        destinationType: "account",
        destinationId: "acct-1",
        operationType: "SOCIAL_PUBLISH_POST",
        idempotencyKey: "idem-publish-now",
      },
      tenant,
    );

    expect(readPublishingCounters()["publishing.scheduled_jobs_enqueued"]).toBe(1);
  });
});
