import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  publishingJob: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  publishingAttempt: { findFirst: vi.fn(), create: vi.fn() },
  contentSchedule: { create: vi.fn(), update: vi.fn() },
  contentItem: { findFirst: vi.fn(), update: vi.fn() },
  socialAccount: { findFirst: vi.fn() },
}));

const credentialMock = vi.hoisted(() => ({
  readTokens: vi.fn(),
  upsertTokens: vi.fn(),
}));

const metaRefreshMock = vi.hoisted(() => vi.fn());
const storageMock = vi.hoisted(() => ({
  createSignedUrl: vi
    .fn()
    .mockResolvedValue({ url: "https://signed.test/a.jpg", expiresAt: new Date() }),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/social-credential-service", () => ({
  socialCredentialService: credentialMock,
}));
vi.mock("@/lib/social/meta-credential-adapter", () => ({
  metaCredentialAdapter: { refreshAccessToken: metaRefreshMock },
}));
vi.mock("@/lib/storage/supabase-storage-provider", () => ({
  createObjectStorageProvider: () => storageMock,
}));
vi.mock("@/server/services/audit-service", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("@/server/services/compliance-agent-service", () => ({
  complianceAgentService: {
    assertPublishable: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: { getById: vi.fn().mockResolvedValue({ id: "brand-1", projectId: "project-1" }) },
}));

import {
  instagramPublishingService,
  MAX_POLL_ATTEMPTS,
} from "@/server/services/instagram-publishing-service";

const TENANT = { organisationId: "org-1", projectId: "project-1", brandId: "brand-1" };

function buildJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    ...TENANT,
    contentScheduleId: "schedule-1",
    idempotencyKey: "key-1",
    status: "QUEUED",
    attemptCount: 0,
    maxAttempts: 3,
    providerContainerId: null,
    providerStatus: null,
    pollingAttemptCount: 0,
    nextPollAt: null,
    lastProviderError: null,
    publishedMediaId: null,
    permalink: null,
    refreshAttemptCount: 0,
    schedule: {
      id: "schedule-1",
      ...TENANT,
      contentItemId: "content-1",
      createdByUserId: "user-1",
      contentItem: { id: "content-1", status: "APPROVED" },
      contentVariant: {
        id: "variant-1",
        ...TENANT,
        provider: "INSTAGRAM",
        socialAccountId: "account-1",
        caption: "Caption",
        altText: "Alt",
        visualAssets: [
          {
            marketingAsset: {
              id: "asset-1",
              storageKey: "org-1/brand-1/asset-1/a.jpg",
              status: "READY",
              approvedForMarketing: true,
              licenceExpiresAt: null,
              assetType: "IMAGE",
            },
          },
        ],
      },
      socialAccount: { ...TENANT, providerAccountId: "ig-1", socialConnectionId: "connection-1" },
    },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("instagramPublishingService.process", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    credentialMock.readTokens.mockResolvedValue({ accessToken: "token", refreshToken: "refresh" });
    prismaMock.publishingJob.update.mockResolvedValue({});
    prismaMock.contentSchedule.update.mockResolvedValue({});
    prismaMock.contentItem.update.mockResolvedValue({});
    prismaMock.publishingAttempt.findFirst.mockResolvedValue(null);
    prismaMock.publishingAttempt.create.mockResolvedValue({});
  });

  it("publishes once and stores the provider post id and permalink", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(buildJob());
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ id: "container-1" }))
        .mockResolvedValueOnce(jsonResponse({ status_code: "FINISHED" }))
        .mockResolvedValueOnce(jsonResponse({ id: "post-1" }))
        .mockResolvedValueOnce(jsonResponse({ permalink: "https://instagram.com/p/post-1" })),
    );

    const result = await instagramPublishingService.process("job-1");

    expect(result).toMatchObject({
      state: "PUBLISHED",
      postId: "post-1",
      containerId: "container-1",
    });
    expect(prismaMock.publishingJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerContainerId: "container-1",
          providerStatus: "IN_PROGRESS",
        }),
      }),
    );
    expect(prismaMock.contentItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PUBLISHED" } }),
    );
  });

  it("never republishes a job that already has a provider post id", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(
      buildJob({ publishedMediaId: "post-1", permalink: "https://instagram.com/p/post-1" }),
    );
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    const result = await instagramPublishingService.process("job-1");

    expect(result).toEqual({
      state: "ALREADY_PUBLISHED",
      postId: "post-1",
      permalink: "https://instagram.com/p/post-1",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reuses the persisted container after a restart instead of creating a second one", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(
      buildJob({
        status: "PROCESSING",
        providerContainerId: "container-existing",
        pollingAttemptCount: 2,
      }),
    );
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(jsonResponse({ id: "post-9" }))
      .mockResolvedValueOnce(jsonResponse({ permalink: "https://instagram.com/p/post-9" }));
    vi.stubGlobal("fetch", fetch);

    const result = await instagramPublishingService.process("job-1");

    expect(result).toMatchObject({ state: "PUBLISHED", containerId: "container-existing" });
    expect(storageMock.createSignedUrl).not.toHaveBeenCalled();
    expect(fetch.mock.calls[0]![0]).toContain("container-existing");
  });

  it("requeues with backoff while the container is still processing", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(
      buildJob({ providerContainerId: "container-1", pollingAttemptCount: 1 }),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status_code: "IN_PROGRESS" })));

    const result = await instagramPublishingService.process("job-1");

    expect(result).toMatchObject({ state: "PROCESSING", pollingAttemptCount: 2 });
    expect(prismaMock.publishingJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "QUEUED" }) }),
    );
  });

  it("fails terminally when the container reports ERROR", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(
      buildJob({ providerContainerId: "container-1" }),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status_code: "ERROR" })));

    const result = await instagramPublishingService.process("job-1");

    expect(result).toMatchObject({ state: "FAILED", reason: "Instagram container error." });
  });

  it("times out after the maximum number of polls", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(
      buildJob({ providerContainerId: "container-1", pollingAttemptCount: MAX_POLL_ATTEMPTS - 1 }),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status_code: "IN_PROGRESS" })));

    const result = await instagramPublishingService.process("job-1");

    expect(result).toMatchObject({
      state: "FAILED",
      reason: "Instagram media processing timed out.",
    });
  });

  it("refreshes Meta credentials once and requeues the job", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(buildJob());
    metaRefreshMock.mockResolvedValue({ accessToken: "fresh-token", scopes: [] });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ error: { message: "Invalid OAuth access token" } }, 400)),
    );

    const result = await instagramPublishingService.process("job-1");

    expect(result).toEqual({ state: "REQUEUED_AFTER_REFRESH", containerId: null });
    expect(credentialMock.upsertTokens).toHaveBeenCalledWith(
      "connection-1",
      expect.objectContaining({ accessToken: "fresh-token" }),
    );
    expect(prismaMock.publishingJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "QUEUED", refreshAttemptCount: { increment: 1 } }),
      }),
    );
  });

  it("does not refresh twice for the same job", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(buildJob({ refreshAttemptCount: 1 }));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ error: { message: "Invalid OAuth access token" } }, 400)),
    );

    const result = await instagramPublishingService.process("job-1");

    expect(result).toMatchObject({ state: "FAILED" });
    expect(metaRefreshMock).not.toHaveBeenCalled();
  });

  it("fails safely when credential refresh itself fails", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(buildJob());
    metaRefreshMock.mockRejectedValue(new Error("Meta refresh rejected"));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ error: { message: "Invalid OAuth access token" } }, 400)),
    );

    const result = await instagramPublishingService.process("job-1");

    expect(result).toEqual({ state: "FAILED", reason: "Meta refresh rejected" });
    expect(credentialMock.upsertTokens).not.toHaveBeenCalled();
  });

  it("retries transient provider failures without publishing", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(
      buildJob({ providerContainerId: "container-1" }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { message: "Server error" } }, 500)),
    );

    const result = await instagramPublishingService.process("job-1");

    expect(result).toMatchObject({ state: "PROCESSING" });
    expect(prismaMock.contentItem.update).not.toHaveBeenCalled();
  });

  it("rejects a job whose schedule belongs to another tenant", async () => {
    const job = buildJob();
    job.schedule.organisationId = "org-2";
    prismaMock.publishingJob.findFirst.mockResolvedValue(job);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    const result = await instagramPublishingService.process("job-1");

    expect(result).toEqual({
      state: "FAILED",
      reason: "Publishing job references records from another tenant.",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects media that is unapproved or past its licence expiry", async () => {
    const job = buildJob();
    job.schedule.contentVariant.visualAssets[0]!.marketingAsset.approvedForMarketing = false;
    prismaMock.publishingJob.findFirst.mockResolvedValue(job);

    const result = await instagramPublishingService.process("job-1");

    expect(result).toMatchObject({ state: "FAILED" });
  });

  it("ignores jobs that are not queued or processing", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(null);
    expect(await instagramPublishingService.process("job-1")).toBeNull();
  });
});

describe("instagramPublishingService.enqueueImmediatePublish", () => {
  const context = { organisationId: "org-1", userProfileId: "user-1" } as never;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the existing job for a repeated idempotency key", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue({ id: "job-existing" });

    const job = await instagramPublishingService.enqueueImmediatePublish(
      "brand-1",
      "org-1",
      "content-1",
      { contentVariantId: "variant-1", socialAccountId: "account-1", idempotencyKey: "key-1" },
      context,
    );

    expect(job).toEqual({ id: "job-existing" });
    expect(prismaMock.publishingJob.create).not.toHaveBeenCalled();
  });

  it("refuses to publish content that is not approved", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(null);
    prismaMock.contentItem.findFirst.mockResolvedValue(null);

    await expect(
      instagramPublishingService.enqueueImmediatePublish(
        "brand-1",
        "org-1",
        "content-1",
        { contentVariantId: "variant-1", socialAccountId: "account-1", idempotencyKey: "key-2" },
        context,
      ),
    ).rejects.toThrow("Only approved content can be published immediately.");
  });

  it("refuses to publish when the Instagram account is not connected", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(null);
    prismaMock.contentItem.findFirst.mockResolvedValue({
      id: "content-1",
      variants: [{ id: "variant-1", provider: "INSTAGRAM", socialAccountId: "account-1" }],
    });
    prismaMock.socialAccount.findFirst.mockResolvedValue(null);

    await expect(
      instagramPublishingService.enqueueImmediatePublish(
        "brand-1",
        "org-1",
        "content-1",
        { contentVariantId: "variant-1", socialAccountId: "account-1", idempotencyKey: "key-3" },
        context,
      ),
    ).rejects.toThrow("Instagram account is not connected.");
  });

  it("creates a queued job for an approved, connected variant", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(null);
    prismaMock.contentItem.findFirst.mockResolvedValue({
      id: "content-1",
      variants: [{ id: "variant-1", provider: "INSTAGRAM", socialAccountId: "account-1" }],
    });
    prismaMock.socialAccount.findFirst.mockResolvedValue({ id: "account-1" });
    prismaMock.contentSchedule.create.mockResolvedValue({ id: "schedule-1" });
    prismaMock.publishingJob.create.mockResolvedValue({ id: "job-new", status: "QUEUED" });

    const job = await instagramPublishingService.enqueueImmediatePublish(
      "brand-1",
      "org-1",
      "content-1",
      { contentVariantId: "variant-1", socialAccountId: "account-1", idempotencyKey: "key-4" },
      context,
    );

    expect(job).toEqual({ id: "job-new", status: "QUEUED" });
    expect(prismaMock.publishingJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ idempotencyKey: "key-4", status: "QUEUED" }),
      }),
    );
  });
});
