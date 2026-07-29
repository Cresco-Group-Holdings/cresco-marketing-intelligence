import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  publishingJob: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  publishingAttempt: { findFirst: vi.fn(), create: vi.fn() },
  contentSchedule: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  contentItem: { findFirst: vi.fn(), update: vi.fn() },
  contentVariant: { findFirst: vi.fn() },
  socialAccount: { findFirst: vi.fn() },
  tikTokPublishSetting: { upsert: vi.fn() },
}));

const credentialMock = vi.hoisted(() => ({ readTokens: vi.fn(), upsertTokens: vi.fn() }));
const refreshMock = vi.hoisted(() => vi.fn());
const storageMock = vi.hoisted(() => ({
  createSignedUrl: vi.fn().mockResolvedValue({
    url: "https://signed.test/video.mp4",
    expiresAt: new Date("2026-07-29T12:00:00Z"),
  }),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/social-credential-service", () => ({
  socialCredentialService: credentialMock,
}));
vi.mock("@/lib/social/tiktok-credential-adapter", () => ({
  tikTokCredentialAdapter: { refreshAccessToken: refreshMock },
}));
vi.mock("@/lib/storage/supabase-storage-provider", () => ({
  createObjectStorageProvider: () => storageMock,
}));
vi.mock("@/server/services/audit-service", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: { getById: vi.fn().mockResolvedValue({ id: "brand-1", projectId: "project-1" }) },
}));

import {
  MAX_TIKTOK_POLL_ATTEMPTS,
  tikTokPublishingService,
} from "@/server/services/tiktok-publishing-service";

const TENANT = { organisationId: "org-1", projectId: "project-1", brandId: "brand-1" };
const context = { organisationId: "org-1", userProfileId: "user-1" } as never;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function videoAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset-1",
    storageKey: "org-1/brand-1/asset-1/video.mp4",
    assetType: "VIDEO",
    status: "READY",
    approvedForMarketing: true,
    licenceExpiresAt: null,
    mimeType: "video/mp4",
    sizeBytes: 5_000_000,
    width: 1080,
    height: 1920,
    durationSeconds: 30,
    ...overrides,
  };
}

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
    publishedMediaId: null,
    refreshAttemptCount: 0,
    directPublishAvailable: true,
    schedule: {
      id: "schedule-1",
      ...TENANT,
      contentItemId: "content-1",
      createdByUserId: "user-1",
      contentItem: { id: "content-1", status: "APPROVED" },
      contentVariant: {
        id: "variant-1",
        ...TENANT,
        provider: "TIKTOK",
        socialAccountId: "account-1",
        caption: "Caption",
        tikTokSetting: {
          privacyLevel: "SELF_ONLY",
          disableComment: false,
          disableDuet: false,
          disableStitch: false,
          brandedContentToggle: false,
          brandOrganicToggle: false,
          videoCoverTimestampMs: null as number | null,
        },
        visualAssets: [{ marketingAsset: videoAsset() }],
      },
      socialAccount: { ...TENANT, providerAccountId: "tt-1", socialConnectionId: "connection-1" },
    },
    ...overrides,
  };
}

describe("tikTokPublishingService.process", () => {
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

  it("initialises a direct post, stores the publish id, and completes", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(buildJob());
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ data: { publish_id: "publish-1" } }))
        .mockResolvedValueOnce(
          jsonResponse({
            data: { status: "PUBLISH_COMPLETE", publicaly_available_post_id: ["post-1"] },
          }),
        ),
    );

    const result = await tikTokPublishingService.process("job-1");

    expect(result).toEqual({ state: "PUBLISHED", postId: "post-1", publishId: "publish-1" });
    expect(prismaMock.publishingJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ providerContainerId: "publish-1" }),
      }),
    );
    expect(prismaMock.contentItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PUBLISHED" } }),
    );
  });

  it("sends the creator's exact privacy and disclosure choices", async () => {
    const job = buildJob();
    job.schedule.contentVariant.tikTokSetting = {
      privacyLevel: "PUBLIC_TO_EVERYONE",
      disableComment: true,
      disableDuet: true,
      disableStitch: false,
      brandedContentToggle: true,
      brandOrganicToggle: false,
      videoCoverTimestampMs: 1500,
    };
    prismaMock.publishingJob.findFirst.mockResolvedValue(job);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { publish_id: "publish-2" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { status: "PROCESSING_UPLOAD" } }));
    vi.stubGlobal("fetch", fetch);

    await tikTokPublishingService.process("job-1");

    const body = JSON.parse(String((fetch.mock.calls[0]![1] as RequestInit).body));
    expect(body.post_info).toMatchObject({
      privacy_level: "PUBLIC_TO_EVERYONE",
      disable_comment: true,
      disable_duet: true,
      brand_content_toggle: true,
      video_cover_timestamp_ms: 1500,
    });
  });

  it("never re-publishes a job that already has a post id", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(buildJob({ publishedMediaId: "post-1" }));
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    expect(await tikTokPublishingService.process("job-1")).toEqual({
      state: "ALREADY_PUBLISHED",
      postId: "post-1",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reuses a persisted publish id after a restart", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(
      buildJob({
        status: "PROCESSING",
        providerContainerId: "publish-existing",
        pollingAttemptCount: 3,
      }),
    );
    const fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({
          data: { status: "PUBLISH_COMPLETE", publicaly_available_post_id: ["post-9"] },
        }),
      );
    vi.stubGlobal("fetch", fetch);

    const result = await tikTokPublishingService.process("job-1");

    expect(result).toMatchObject({ state: "PUBLISHED", publishId: "publish-existing" });
    expect(storageMock.createSignedUrl).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("requeues with backoff while TikTok is still processing", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(
      buildJob({ providerContainerId: "publish-1", pollingAttemptCount: 2 }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ data: { status: "PROCESSING_UPLOAD" } })),
    );

    const result = await tikTokPublishingService.process("job-1");

    expect(result).toMatchObject({ state: "PROCESSING", pollingAttemptCount: 3 });
  });

  it("times out after the maximum number of polls", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(
      buildJob({
        providerContainerId: "publish-1",
        pollingAttemptCount: MAX_TIKTOK_POLL_ATTEMPTS - 1,
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ data: { status: "PROCESSING_UPLOAD" } })),
    );

    expect(await tikTokPublishingService.process("job-1")).toMatchObject({
      state: "FAILED",
      reason: "TikTok processing timed out.",
    });
  });

  it("fails with the moderation reason when TikTok rejects the video", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(
      buildJob({ providerContainerId: "publish-1" }),
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ data: { status: "FAILED", fail_reason: "content moderation" } }),
        ),
    );

    expect(await tikTokPublishingService.process("job-1")).toEqual({
      state: "FAILED",
      reason: "content moderation",
    });
  });

  it("switches to manual fallback when the app is unaudited", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(buildJob());
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { code: "unaudited_client_can_only_post_to_private_accounts" } },
            403,
          ),
        ),
    );

    const result = await tikTokPublishingService.process("job-1");

    expect(result).toMatchObject({ state: "MANUAL_FALLBACK_REQUIRED" });
    expect(prismaMock.publishingJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ directPublishAvailable: false }) }),
    );
    // Manual fallback must never mark the content as published.
    expect(prismaMock.contentItem.update).not.toHaveBeenCalled();
  });

  it("switches to manual fallback when the pull URL prefix is unverified", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(buildJob());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { code: "url_ownership_unverified" } }, 400)),
    );

    expect(await tikTokPublishingService.process("job-1")).toMatchObject({
      state: "MANUAL_FALLBACK_REQUIRED",
    });
  });

  it("refreshes the token once and requeues", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(buildJob());
    refreshMock.mockResolvedValue({
      accessToken: "fresh",
      refreshToken: "fresh-refresh",
      scopes: [],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { code: "access_token_invalid" } }, 401)),
    );

    expect(await tikTokPublishingService.process("job-1")).toEqual({
      state: "REQUEUED_AFTER_REFRESH",
    });
    expect(credentialMock.upsertTokens).toHaveBeenCalledWith(
      "connection-1",
      expect.objectContaining({ accessToken: "fresh" }),
    );
  });

  it("does not refresh twice for the same job", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(buildJob({ refreshAttemptCount: 1 }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { code: "access_token_invalid" } }, 401)),
    );

    expect(await tikTokPublishingService.process("job-1")).toMatchObject({ state: "FAILED" });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("fails safely when the refresh itself fails", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(buildJob());
    refreshMock.mockRejectedValue(new Error("TikTok refresh rejected"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { code: "access_token_invalid" } }, 401)),
    );

    expect(await tikTokPublishingService.process("job-1")).toEqual({
      state: "FAILED",
      reason: "TikTok refresh rejected",
    });
  });

  it("retries a transient provider failure without publishing", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(
      buildJob({ providerContainerId: "publish-1" }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { code: "internal_error" } }, 500)),
    );

    expect(await tikTokPublishingService.process("job-1")).toMatchObject({ state: "PROCESSING" });
    expect(prismaMock.contentItem.update).not.toHaveBeenCalled();
  });

  it("rejects a job whose records belong to another tenant", async () => {
    const job = buildJob();
    job.schedule.socialAccount.organisationId = "org-2";
    prismaMock.publishingJob.findFirst.mockResolvedValue(job);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    expect(await tikTokPublishingService.process("job-1")).toEqual({
      state: "FAILED",
      reason: "Publishing job references records from another tenant.",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses to publish without confirmed posting settings", async () => {
    const job = buildJob();
    job.schedule.contentVariant.tikTokSetting = null as never;
    prismaMock.publishingJob.findFirst.mockResolvedValue(job);

    expect(await tikTokPublishingService.process("job-1")).toEqual({
      state: "FAILED",
      reason: "TikTok posting settings were not confirmed.",
    });
  });

  it("refuses to publish an expired-licence video", async () => {
    const job = buildJob();
    job.schedule.contentVariant.visualAssets = [
      { marketingAsset: videoAsset({ licenceExpiresAt: new Date("2020-01-01") }) },
    ];
    prismaMock.publishingJob.findFirst.mockResolvedValue(job);

    expect(await tikTokPublishingService.process("job-1")).toMatchObject({ state: "FAILED" });
  });
});

describe("tikTokPublishingService.enqueuePublish", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the existing job for a repeated idempotency key", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue({ id: "job-existing" });

    const job = await tikTokPublishingService.enqueuePublish(
      "brand-1",
      "org-1",
      "content-1",
      {
        contentVariantId: "variant-1",
        socialAccountId: "account-1",
        confirmed: true,
        idempotencyKey: "key-1",
      },
      context,
    );

    expect(job).toEqual({ id: "job-existing" });
    expect(prismaMock.publishingJob.create).not.toHaveBeenCalled();
  });

  it("refuses unapproved content", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(null);
    prismaMock.contentItem.findFirst.mockResolvedValue(null);

    await expect(
      tikTokPublishingService.enqueuePublish(
        "brand-1",
        "org-1",
        "content-1",
        {
          contentVariantId: "variant-1",
          socialAccountId: "account-1",
          confirmed: true,
          idempotencyKey: "key-2",
        },
        context,
      ),
    ).rejects.toThrow("Only approved content can be published to TikTok.");
  });

  it("refuses to publish before posting settings are confirmed", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue(null);
    prismaMock.contentItem.findFirst.mockResolvedValue({ id: "content-1" });
    prismaMock.contentVariant.findFirst.mockResolvedValue({
      id: "variant-1",
      contentItemId: "content-1",
      socialAccountId: "account-1",
      tikTokSetting: null,
      visualAssets: [{ marketingAsset: videoAsset() }],
      socialAccount: { id: "account-1" },
    });

    await expect(
      tikTokPublishingService.enqueuePublish(
        "brand-1",
        "org-1",
        "content-1",
        {
          contentVariantId: "variant-1",
          socialAccountId: "account-1",
          confirmed: true,
          idempotencyKey: "key-3",
        },
        context,
      ),
    ).rejects.toThrow("Confirm the TikTok posting settings before publishing.");
  });
});

describe("tikTokPublishingService manual fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.contentVariant.findFirst.mockResolvedValue({
      id: "variant-1",
      caption: "Caption",
      hashtags: ["#brand"],
      tikTokSetting: { privacyLevel: "SELF_ONLY" },
      visualAssets: [{ marketingAsset: videoAsset() }],
      socialAccount: { id: "account-1", socialConnectionId: "connection-1" },
    });
  });

  it("returns a downloadable package with the confirmed settings", async () => {
    const result = await tikTokPublishingService.getFallbackPackage(
      "brand-1",
      "org-1",
      "variant-1",
      context,
    );

    expect(result).toMatchObject({
      directPublishAvailable: false,
      downloadUrl: "https://signed.test/video.mp4",
      caption: "Caption",
    });
    expect(result.instructions).toContain("Download the video");
  });

  it("records a manually completed publication only when the user confirms", async () => {
    prismaMock.publishingJob.findFirst.mockResolvedValue({
      id: "job-1",
      projectId: "project-1",
      contentScheduleId: "schedule-1",
    });
    prismaMock.publishingJob.update.mockResolvedValue({
      id: "job-1",
      manualPublicUrl: "https://tiktok.com/v/1",
    });
    prismaMock.contentSchedule.findUnique.mockResolvedValue({ contentItemId: "content-1" });

    const job = await tikTokPublishingService.confirmManualPublication(
      "brand-1",
      "org-1",
      "job-1",
      "https://tiktok.com/v/1",
      context,
    );

    expect(job).toMatchObject({ manualPublicUrl: "https://tiktok.com/v/1" });
    expect(prismaMock.publishingJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          manualPublicUrl: "https://tiktok.com/v/1",
          directPublishAvailable: false,
          manualConfirmedByUserId: "user-1",
        }),
      }),
    );
  });
});
