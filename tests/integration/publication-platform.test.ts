import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPlatformAdapterCacheForTests } from "@/lib/providers/platform-registry";
import { resetMockSocialAdapterState } from "@/server/providers/mock-social/mock-social-adapter";

const prismaMock = {
  publication: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  publicationAttempt: {
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  providerConnection: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  contentItem: { findFirst: vi.fn() },
  complianceOverride: { findFirst: vi.fn() },
  publishingJob: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("@/server/services/publication-publishing-worker", () => ({
  processPublicationPublishingJob: vi.fn().mockResolvedValue({
    state: "PUBLISHED",
    externalPublicationId: "mock-post-external",
    permalink: "https://mock-social.test/posts/mock-post-external",
  }),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/server/services/workspace-service", () => ({
  brandService: { getById: vi.fn().mockResolvedValue({ projectId: "proj-1" }) },
}));

vi.mock("@/server/services/compliance-agent-service", () => ({
  complianceAgentService: {
    assertPublishable: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/server/services/audit-service", () => ({
  recordAuditEvent: vi.fn(),
}));

vi.mock("@/server/services/provider-audit-service", () => ({
  providerAuditService: { recordEvent: vi.fn() },
}));

vi.mock("@/server/services/provider-credential-service", () => ({
  providerCredentialService: {
    getCredentialPlaintext: vi.fn().mockResolvedValue("valid-token"),
  },
}));

vi.mock("@/server/services/provider-health-service", () => ({
  providerHealthService: { upsertHealth: vi.fn() },
}));

vi.mock("@/server/services/notification-event-service", () => ({
  notificationEventService: {
    publicationSucceeded: vi.fn().mockResolvedValue(undefined),
    publicationFailed: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("publication execution integration", () => {
  const tenant = {
    userId: "user-1",
    userProfileId: "profile-1",
    organisationId: "org-1",
    organisationRole: "ADMIN" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetPlatformAdapterCacheForTests();
    resetMockSocialAdapterState();
  });

  it("prevents duplicate publication via idempotency key", async () => {
    const { publicationService } = await import("@/server/services/publication-service");

    prismaMock.publication.findFirst.mockResolvedValueOnce({
      id: "pub-existing",
      organisationId: "org-1",
      brandId: "brand-1",
      contentItemId: "content-1",
      connectionId: "conn-1",
      providerKey: "mock-social",
      externalAccountId: "acct-1",
      destinationType: "account",
      destinationId: "acct-1",
      operationType: "SOCIAL_PUBLISH_POST",
      status: "PUBLISHED",
      scheduledFor: null,
      timezone: "UTC",
      idempotencyKey: "idem-1",
      externalPublicationId: "ext-1",
      approvedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      providerPermalink: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: new Date(),
      cancelledAt: null,
    });

    const result = await publicationService.create(
      "brand-1",
      "org-1",
      {
        contentItemId: "content-1",
        connectionId: "conn-1",
        externalAccountId: "acct-1",
        destinationType: "account",
        destinationId: "acct-1",
        operationType: "SOCIAL_PUBLISH_POST",
        idempotencyKey: "idem-1",
      },
      tenant,
    );

    expect(result.publication.id).toBe("pub-existing");
    expect(prismaMock.publication.create).not.toHaveBeenCalled();
  });

  it("executes mock social publish through provider gateway", async () => {
    const { publicationExecutionService } = await import(
      "@/server/services/publication-execution-service"
    );

    prismaMock.publication.findFirst.mockResolvedValue({
      id: "pub-1",
      organisationId: "org-1",
      brandId: "brand-1",
      projectId: "proj-1",
      connectionId: "conn-1",
      providerKey: "mock-social",
      operationType: "SOCIAL_PUBLISH_POST",
      status: "APPROVED",
      externalAccountId: "acct-1",
      destinationId: "acct-1",
      scheduledFor: null,
      timezone: "UTC",
      idempotencyKey: "idem-exec-1",
      dryRun: false,
      providerPayload: {},
      budgetChanges: [],
      contentItem: { variants: [] },
    });
    prismaMock.publishingJob.findFirst.mockResolvedValue(null);
    prismaMock.publishingJob.create.mockResolvedValue({ id: "job-1" });
    prismaMock.publication.update.mockResolvedValue({});

    const result = await publicationExecutionService.execute("pub-1", "org-1", "brand-1", tenant);

    expect(result.success).toBe(true);
    expect(result.result?.state).toBe("PUBLISHED");
    if (result.result?.state === "PUBLISHED") {
      expect(result.result.externalPublicationId).toBeTruthy();
    }
  });
});
