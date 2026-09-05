/**
 * Journey B — Content → Publish
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetPublishingCounters } from "@/lib/publishing/observability";
import { setClockForTests } from "@/lib/workers/clock";
import { finishJourneyMonitor, resetJourneyMonitor } from "../harness/journey-monitor";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  publishingJob: { findUnique: vi.fn(), update: vi.fn() },
  publication: { update: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  publicationAttempt: { create: vi.fn(), update: vi.fn(), count: vi.fn() },
  contentAsset: { findMany: vi.fn() },
  providerConnection: { update: vi.fn() },
}));

const tokenLifecycleMock = vi.hoisted(() => ({ getValidAccessToken: vi.fn() }));
const providerGatewayMock = vi.hoisted(() => ({ execute: vi.fn() }));
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
  return { ...actual, buildTenantContextForUser: buildTenantContextForUserMock };
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
    publicationFailed: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/lib/storage/supabase-storage-provider", () => ({
  createObjectStorageProvider: () => ({
    createSignedUrl: vi.fn().mockResolvedValue({ url: "https://signed.test/media.jpg" }),
  }),
}));

import { processPublicationPublishingJob } from "@/server/services/publication-publishing-worker";
import { discoverPublishingDueWork } from "@/server/services/worker-due-providers/publishing-due-provider";

const tenant = {
  userId: "auth-golden-b",
  userProfileId: "profile-golden-b",
  organisationId: "org-golden-b",
  organisationRole: "ADMIN" as const,
  projectId: "project-golden-b",
  brandId: "brand-golden-b",
};

function publicationFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "pub-golden-b",
    organisationId: tenant.organisationId,
    projectId: tenant.projectId,
    brandId: tenant.brandId,
    connectionId: "conn-1",
    providerKey: "mock-social",
    operationType: "SOCIAL_PUBLISH_POST",
    status: "QUEUED",
    externalAccountId: "acct-1",
    destinationId: "acct-1",
    scheduledFor: new Date("2026-07-15T12:05:00.000Z"),
    timezone: "UTC",
    idempotencyKey: "idem-golden-b",
    dryRun: false,
    providerPayload: { mediaUrls: ["https://signed.test/media.jpg"] },
    requestedByUserId: tenant.userProfileId,
    contentItemId: "content-golden-b",
    contentVariantId: "variant-golden-b",
    contentItem: {
      primaryMessage: "Golden publish",
      variants: [{ id: "variant-golden-b", caption: "Golden publish" }],
    },
    ...overrides,
  };
}

function transactionMock(publication = publicationFixture(), attemptCount = 0) {
  return {
    $executeRaw: vi.fn(),
    publishingJob: {
      findUnique: vi.fn().mockResolvedValue({
        id: "job-golden-b",
        publicationId: "pub-golden-b",
        status: "QUEUED",
        attemptCount,
        publication,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    publication: { update: vi.fn().mockResolvedValue({}), count: vi.fn().mockResolvedValue(0) },
    publicationAttempt: prismaMock.publicationAttempt,
    contentAsset: {
      findMany: vi.fn().mockResolvedValue([
        {
          marketingAsset: {
            id: "asset-1",
            status: "READY",
            approvedForMarketing: true,
            assetType: "IMAGE",
            licenceExpiresAt: null,
            mimeType: "image/jpeg",
          },
        },
      ]),
    },
    providerConnection: { update: vi.fn().mockResolvedValue({}) },
  };
}

describe("Golden Journey B — Content → Publish", () => {
  const FIXED_NOW = new Date("2026-07-15T12:10:00.000Z");

  beforeEach(() => {
    resetJourneyMonitor();
    vi.clearAllMocks();
    resetPublishingCounters();
    setClockForTests({ now: () => FIXED_NOW, random: () => 0 });
    buildTenantContextForUserMock.mockResolvedValue(tenant);
    tokenLifecycleMock.getValidAccessToken.mockResolvedValue({ accessToken: "token-1", status: "VALID" });
    providerGatewayMock.execute.mockResolvedValue({
      success: true,
      data: { externalPublicationId: "ext-golden-b", permalink: "https://mock.test/p/ext-golden-b", duplicate: false },
    });
    prismaMock.publicationAttempt.count.mockResolvedValue(0);
    prismaMock.publicationAttempt.create.mockResolvedValue({ id: "attempt-1", requestId: "req-1" });
    prismaMock.publicationAttempt.update.mockResolvedValue({});
    prismaMock.publishingJob.update.mockResolvedValue({});
  });

  afterEach(() => {
    setClockForTests(null);
  });

  it("schedules, publishes via worker, and remains idempotent on retry", async () => {
    prismaMock.publication.findMany.mockResolvedValue([]);
    const due = await discoverPublishingDueWork(FIXED_NOW, 10);
    expect(due).toHaveLength(0);

    const scheduled = publicationFixture({ status: "QUEUED" });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(transactionMock(scheduled)));

    const published = await processPublicationPublishingJob("job-golden-b", tenant);
    expect(published?.state).toBe("PUBLISHED");
    expect(providerGatewayMock.execute).toHaveBeenCalledTimes(1);

    providerGatewayMock.execute.mockResolvedValue({
      success: true,
      data: { externalPublicationId: "ext-golden-b", duplicate: true },
    });
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(transactionMock({ ...scheduled, status: "QUEUED" }, 2)),
    );
    const duplicate = await processPublicationPublishingJob("job-golden-b", tenant);
    expect(duplicate).toEqual({ state: "DUPLICATE", externalPublicationId: "ext-golden-b" });
    expect(providerGatewayMock.execute).toHaveBeenCalledTimes(2);

    const metrics = finishJourneyMonitor();
    expect(metrics.unexpected5xx).toBe(0);
  });
});
