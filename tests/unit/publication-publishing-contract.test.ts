import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPublishingCounters, readPublishingCounters } from "@/lib/publishing/observability";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  publishingJob: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  contentAsset: {
    findMany: vi.fn(),
  },
  publicationAttempt: {
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
}));

const tokenLifecycleMock = vi.hoisted(() => ({
  getValidAccessToken: vi.fn(),
}));

const providerGatewayMock = vi.hoisted(() => ({
  execute: vi.fn(),
}));

const buildTenantContextForUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/token-lifecycle-service", () => ({
  tokenLifecycleService: tokenLifecycleMock,
}));
vi.mock("@/server/services/provider-gateway-service", () => ({
  providerGateway: providerGatewayMock,
}));
vi.mock("@/lib/tenancy/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenancy/guards")>();
  return {
    ...actual,
    buildTenantContextForUser: buildTenantContextForUserMock,
  };
});
vi.mock("@/server/services/calendar-projection-service", () => ({
  calendarProjectionService: { syncPublication: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@/server/services/audit-service", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/services/notification-event-service", () => ({
  notificationEventService: {
    publicationSucceeded: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/lib/storage/supabase-storage-provider", () => ({
  createObjectStorageProvider: () => ({
    createSignedUrl: vi.fn().mockResolvedValue({ url: "https://signed.test/media.jpg" }),
  }),
}));

import { processPublicationPublishingJob } from "@/server/services/publication-publishing-worker";

const tenant = {
  userId: "auth-user-1",
  userProfileId: "profile-1",
  organisationId: "org-1",
  organisationRole: "ADMIN" as const,
  projectId: "proj-1",
  brandId: "brand-1",
};

function publicationFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "pub-1",
    organisationId: "org-1",
    projectId: "proj-1",
    brandId: "brand-1",
    connectionId: "conn-1",
    providerKey: "mock-social",
    operationType: "SOCIAL_PUBLISH_POST",
    status: "QUEUED",
    externalAccountId: "acct-1",
    destinationId: "acct-1",
    scheduledFor: null,
    timezone: "UTC",
    idempotencyKey: "idem-1",
    dryRun: false,
    providerPayload: {},
    requestedByUserId: "profile-1",
    contentItemId: "content-1",
    contentVariantId: null,
    contentItem: {
      primaryMessage: "Hello",
      variants: [{ id: "var-1", caption: "Hello" }],
    },
    ...overrides,
  };
}

function jobFixture(publication = publicationFixture()) {
  return {
    id: "job-1",
    publicationId: "pub-1",
    status: "QUEUED",
    attemptCount: 0,
    publication,
  };
}

describe("processPublicationPublishingJob contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPublishingCounters();
    buildTenantContextForUserMock.mockResolvedValue(tenant);
    tokenLifecycleMock.getValidAccessToken.mockResolvedValue({
      accessToken: "token-1",
      status: "VALID",
    });
    providerGatewayMock.execute.mockResolvedValue({
      success: true,
      data: {
        externalPublicationId: "ext-post-1",
        permalink: "https://mock.test/posts/ext-post-1",
        duplicate: false,
      },
    });
    prismaMock.publicationAttempt.count.mockResolvedValue(0);
    prismaMock.publicationAttempt.create.mockResolvedValue({ id: "attempt-1", requestId: "req-1" });
    prismaMock.publicationAttempt.update.mockResolvedValue({});
    prismaMock.publishingJob.update.mockResolvedValue({});
    prismaMock.contentAsset.findMany.mockResolvedValue([]);
  });

  it("returns null when the job has no publication", async () => {
    prismaMock.publishingJob.findUnique.mockResolvedValue({
      id: "job-orphan",
      publicationId: null,
      publication: null,
    });

    const result = await processPublicationPublishingJob("job-orphan");
    expect(result).toBeNull();
  });

  it("builds tenant context via buildTenantContextForUser when context is omitted", async () => {
    const publication = publicationFixture();
    prismaMock.publishingJob.findUnique.mockResolvedValue({
      publicationId: "pub-1",
      publication: {
        organisationId: publication.organisationId,
        projectId: publication.projectId,
        brandId: publication.brandId,
        requestedByUserId: publication.requestedByUserId,
      },
    });

    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({
        $executeRaw: vi.fn(),
        publishingJob: {
          findUnique: vi.fn().mockResolvedValue(jobFixture(publication)),
          update: vi.fn().mockResolvedValue({}),
        },
        publication: { update: vi.fn().mockResolvedValue({}), count: vi.fn().mockResolvedValue(0) },
        publicationAttempt: prismaMock.publicationAttempt,
      }),
    );

    await processPublicationPublishingJob("job-1");

    expect(buildTenantContextForUserMock).toHaveBeenCalledWith("profile-1", {
      organisationId: "org-1",
      projectId: "proj-1",
      brandId: "brand-1",
    });
  });

  it("emits jobs_processed on start and completed_jobs on success", async () => {
    const publication = publicationFixture();
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({
        $executeRaw: vi.fn(),
        publishingJob: {
          findUnique: vi.fn().mockResolvedValue(jobFixture(publication)),
          update: vi.fn().mockResolvedValue({}),
        },
        publication: { update: vi.fn().mockResolvedValue({}), count: vi.fn().mockResolvedValue(0) },
        publicationAttempt: prismaMock.publicationAttempt,
      }),
    );

    const result = await processPublicationPublishingJob("job-1", tenant);

    expect(result?.state).toBe("PUBLISHED");
    const counters = readPublishingCounters();
    expect(counters["publishing.jobs_processed"]).toBe(2);
    expect(counters["publishing.completed_jobs"]).toBe(1);
  });

  it("emits jobs_failed when the provider returns a terminal error", async () => {
    providerGatewayMock.execute.mockResolvedValue({
      success: false,
      errorCode: "PROVIDER_REJECTED",
      errorMessageSafe: "Rejected by provider.",
      retryable: false,
    });

    const publication = publicationFixture();
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({
        $executeRaw: vi.fn(),
        publishingJob: {
          findUnique: vi.fn().mockResolvedValue(jobFixture(publication)),
          update: vi.fn().mockResolvedValue({}),
        },
        publication: { update: vi.fn().mockResolvedValue({}), count: vi.fn().mockResolvedValue(0) },
        publicationAttempt: prismaMock.publicationAttempt,
      }),
    );

    const result = await processPublicationPublishingJob("job-1", tenant);

    expect(result?.state).toBe("FAILED");
    expect(readPublishingCounters()["publishing.jobs_failed"]).toBe(1);
  });

  it("records duplicate outcomes with jobs_processed duplicate context", async () => {
    providerGatewayMock.execute.mockResolvedValue({
      success: true,
      data: {
        externalPublicationId: "ext-dup",
        duplicate: true,
      },
    });

    const publication = publicationFixture();
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({
        $executeRaw: vi.fn(),
        publishingJob: {
          findUnique: vi.fn().mockResolvedValue(jobFixture(publication)),
          update: vi.fn().mockResolvedValue({}),
        },
        publication: { update: vi.fn().mockResolvedValue({}), count: vi.fn().mockResolvedValue(0) },
        publicationAttempt: prismaMock.publicationAttempt,
      }),
    );

    const result = await processPublicationPublishingJob("job-1", tenant);

    expect(result).toEqual({ state: "DUPLICATE", externalPublicationId: "ext-dup" });
    expect(readPublishingCounters()["publishing.completed_jobs"]).toBe(1);
    expect(readPublishingCounters()["publishing.jobs_processed"]).toBe(2);
  });
});
