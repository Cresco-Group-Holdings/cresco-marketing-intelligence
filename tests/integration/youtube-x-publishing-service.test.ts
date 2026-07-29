import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  publishingJob: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  publishingAttempt: { findFirst: vi.fn(), create: vi.fn() },
  contentSchedule: { create: vi.fn(), update: vi.fn() },
  contentItem: { findFirst: vi.fn(), update: vi.fn() },
  contentVariant: { findFirst: vi.fn() },
}));
const credentials = vi.hoisted(() => ({ readTokens: vi.fn(), upsertTokens: vi.fn() }));
const storage = vi.hoisted(() => ({
  createSignedUrl: vi
    .fn()
    .mockResolvedValue({ url: "https://signed.test/file", expiresAt: new Date() }),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma }));
vi.mock("@/server/services/social-credential-service", () => ({
  socialCredentialService: credentials,
}));
vi.mock("@/lib/storage/supabase-storage-provider", () => ({
  createObjectStorageProvider: () => storage,
}));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: { getById: vi.fn().mockResolvedValue({ projectId: "project-1" }) },
}));

import { youtubeXPublishingService } from "@/server/services/youtube-x-publishing-service";
import { resetEnvCacheForTests } from "@/lib/environment";

const context = { organisationId: "org-1", userProfileId: "user-1" } as never;
const video = {
  id: "video-asset",
  assetType: "VIDEO",
  mimeType: "video/mp4",
  sizeBytes: 1000,
  width: 1080,
  height: 1920,
  durationSeconds: 30,
  storageKey: "video.mp4",
  status: "READY",
  approvedForMarketing: true,
  licenceExpiresAt: null,
};

function job(provider: "YOUTUBE" | "X", overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    organisationId: "org-1",
    projectId: "project-1",
    brandId: "brand-1",
    contentScheduleId: "schedule-1",
    status: "QUEUED",
    attemptCount: 0,
    maxAttempts: 3,
    pollingAttemptCount: 0,
    refreshAttemptCount: 0,
    providerContainerId: null,
    providerUploadState: null,
    publishedMediaId: null,
    providerSettings:
      provider === "YOUTUBE"
        ? {
            provider,
            title: "Title",
            description: "Description",
            tags: [],
            categoryId: "22",
            privacyStatus: "private",
            madeForKids: false,
            rightsConfirmed: true,
          }
        : { provider, posts: ["First", "Second"], entitlementConfirmed: true },
    schedule: {
      id: "schedule-1",
      organisationId: "org-1",
      brandId: "brand-1",
      contentItemId: "content-1",
      contentItem: { status: "APPROVED" },
      socialAccount: {
        organisationId: "org-1",
        socialConnectionId: "connection-1",
      },
      contentVariant: {
        thumbnailAssetId: null,
        visualAssets: provider === "YOUTUBE" ? [{ marketingAsset: video }] : [],
      },
    },
    ...overrides,
  };
}

const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });

describe("YouTube/X durable publishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    credentials.readTokens.mockResolvedValue({ accessToken: "token", refreshToken: "refresh" });
    prisma.publishingJob.update.mockResolvedValue({});
    prisma.publishingAttempt.findFirst.mockResolvedValue(null);
    prisma.publishingAttempt.create.mockResolvedValue({});
    prisma.contentSchedule.update.mockResolvedValue({});
    prisma.contentItem.update.mockResolvedValue({});
    process.env.GOOGLE_CLIENT_ID = "google-client";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret";
    process.env.X_CLIENT_ID = "x-client";
    process.env.X_CLIENT_SECRET = "x-secret";
    resetEnvCacheForTests();
  });

  it("uploads and reconciles a YouTube video", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue(job("YOUTUBE"));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({}, 200, { location: "https://upload/session" }))
        .mockResolvedValueOnce(new Response("video"))
        .mockResolvedValueOnce(json({ id: "youtube-1" }))
        .mockResolvedValueOnce(
          json({ items: [{ processingDetails: { processingStatus: "succeeded" } }] }),
        ),
    );
    expect(await youtubeXPublishingService.process("job-1")).toMatchObject({
      state: "PUBLISHED",
      postId: "youtube-1",
    });
  });

  it("resumes YouTube processing from a persisted video ID", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue(
      job("YOUTUBE", {
        providerUploadState: {
          uploadUrl: "https://upload/session",
          videoId: "youtube-existing",
        },
      }),
    );
    const fetch = vi
      .fn()
      .mockResolvedValue(
        json({ items: [{ processingDetails: { processingStatus: "processing" } }] }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await youtubeXPublishingService.process("job-1")).toMatchObject({
      state: "PROCESSING",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("probes and resumes a partially uploaded YouTube session from the first missing byte", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue(
      job("YOUTUBE", {
        providerUploadState: {
          sessionUrl: "https://upload/session",
          totalFileSize: 1000,
          confirmedUploadedByteOffset: 500,
          nextChunkOffset: 500,
          chunkSize: 500,
          retryCount: 0,
        },
      }),
    );
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 308, headers: { range: "bytes=0-499" } }))
      .mockResolvedValueOnce(new Response(new Uint8Array(500), { status: 206 }))
      .mockResolvedValueOnce(json({ id: "youtube-resumed" }))
      .mockResolvedValueOnce(
        json({ items: [{ processingDetails: { processingStatus: "succeeded" } }] }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await youtubeXPublishingService.process("job-1")).toMatchObject({
      state: "PUBLISHED",
      postId: "youtube-resumed",
    });
    expect((fetch.mock.calls[1]![1] as RequestInit).headers).toEqual({
      range: "bytes=500-999",
    });
  });

  it("uses a completed-session probe without uploading video bytes again", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue(
      job("YOUTUBE", {
        providerUploadState: {
          sessionUrl: "https://upload/session",
          totalFileSize: 1000,
          nextChunkOffset: 500,
        },
      }),
    );
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ id: "youtube-complete" }))
      .mockResolvedValueOnce(
        json({ items: [{ processingDetails: { processingStatus: "succeeded" } }] }),
      );
    vi.stubGlobal("fetch", fetch);
    await youtubeXPublishingService.process("job-1");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });

  it("replaces a YouTube session only after the provider confirms it expired", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue(
      job("YOUTUBE", {
        providerUploadState: {
          sessionUrl: "https://upload/expired",
          totalFileSize: 1000,
          nextChunkOffset: 500,
        },
      }),
    );
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 410 }))
      .mockResolvedValueOnce(json({}, 200, { location: "https://upload/replacement" }))
      .mockResolvedValueOnce(new Response(new Uint8Array(1000), { status: 206 }))
      .mockResolvedValueOnce(json({ id: "youtube-replacement" }))
      .mockResolvedValueOnce(
        json({ items: [{ processingDetails: { processingStatus: "succeeded" } }] }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await youtubeXPublishingService.process("job-1")).toMatchObject({
      postId: "youtube-replacement",
    });
    expect(String(fetch.mock.calls[0]![0])).toBe("https://upload/expired");
  });

  it("uploads a custom YouTube thumbnail after processing", async () => {
    const data = job("YOUTUBE", {
      providerUploadState: {
        uploadUrl: "https://upload/session",
        videoId: "youtube-1",
      },
    });
    data.schedule.contentVariant.thumbnailAssetId = "thumb-1" as never;
    data.schedule.contentVariant.visualAssets.push({
      marketingAsset: {
        ...video,
        id: "thumb-1",
        assetType: "IMAGE",
        mimeType: "image/jpeg",
        storageKey: "thumb.jpg",
      },
    });
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          json({ items: [{ processingDetails: { processingStatus: "succeeded" } }] }),
        )
        .mockResolvedValueOnce(new Response("thumb"))
        .mockResolvedValueOnce(json({})),
    );
    await youtubeXPublishingService.process("job-1");
    expect(storage.createSignedUrl).toHaveBeenCalledWith("thumb.jpg", 3600);
  });

  it("retries a transient thumbnail failure without creating another video", async () => {
    const data = job("YOUTUBE", {
      providerUploadState: {
        sessionUrl: "session",
        videoId: "youtube-1",
        thumbnailStatus: "PENDING",
        thumbnailRetryCount: 0,
      },
    });
    data.schedule.contentVariant.thumbnailAssetId = "thumb-1" as never;
    data.schedule.contentVariant.visualAssets.push({
      marketingAsset: {
        ...video,
        id: "thumb-1",
        assetType: "IMAGE",
        mimeType: "image/jpeg",
        storageKey: "thumb.jpg",
      },
    });
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          json({ items: [{ processingDetails: { processingStatus: "succeeded" } }] }),
        )
        .mockResolvedValueOnce(new Response("thumb"))
        .mockResolvedValueOnce(json({}, 500)),
    );
    expect(await youtubeXPublishingService.process("job-1")).toEqual({
      state: "THUMBNAIL_RETRY",
      videoId: "youtube-1",
    });
    expect(
      prisma.publishingJob.update.mock.calls.some((call) =>
        JSON.stringify(call[0]).includes('"thumbnailStatus":"PENDING"'),
      ),
    ).toBe(true);
  });

  it("does not upload a thumbnail twice after restart", async () => {
    const data = job("YOUTUBE", {
      providerUploadState: {
        sessionUrl: "session",
        videoId: "youtube-1",
        thumbnailStatus: "UPLOADED",
      },
    });
    data.schedule.contentVariant.thumbnailAssetId = "thumb-1" as never;
    data.schedule.contentVariant.visualAssets.push({
      marketingAsset: { ...video, id: "thumb-1", assetType: "IMAGE" },
    });
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    const fetch = vi
      .fn()
      .mockResolvedValue(
        json({ items: [{ processingDetails: { processingStatus: "succeeded" } }] }),
      );
    vi.stubGlobal("fetch", fetch);
    await youtubeXPublishingService.process("job-1");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("completes a pending thumbnail on restart without re-uploading the video", async () => {
    const data = job("YOUTUBE", {
      providerUploadState: {
        sessionUrl: "session",
        videoId: "youtube-1",
        thumbnailStatus: "PENDING",
        thumbnailRetryCount: 1,
      },
    });
    data.schedule.contentVariant.thumbnailAssetId = "thumb-1" as never;
    data.schedule.contentVariant.visualAssets.push({
      marketingAsset: {
        ...video,
        id: "thumb-1",
        assetType: "IMAGE",
        mimeType: "image/jpeg",
        storageKey: "thumb.jpg",
      },
    });
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json({ items: [{ processingDetails: { processingStatus: "succeeded" } }] }),
      )
      .mockResolvedValueOnce(new Response("thumb"))
      .mockResolvedValueOnce(json({}));
    vi.stubGlobal("fetch", fetch);
    expect(await youtubeXPublishingService.process("job-1")).toMatchObject({
      state: "PUBLISHED",
      postId: "youtube-1",
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("records a terminal thumbnail failure without creating another video", async () => {
    const data = job("YOUTUBE", {
      providerUploadState: {
        sessionUrl: "session",
        videoId: "youtube-1",
        thumbnailStatus: "PENDING",
        thumbnailRetryCount: 2,
      },
    });
    data.schedule.contentVariant.thumbnailAssetId = "thumb-1" as never;
    data.schedule.contentVariant.visualAssets.push({
      marketingAsset: {
        ...video,
        id: "thumb-1",
        assetType: "IMAGE",
        mimeType: "image/jpeg",
      },
    });
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          json({ items: [{ processingDetails: { processingStatus: "succeeded" } }] }),
        )
        .mockResolvedValueOnce(new Response("thumb"))
        .mockResolvedValueOnce(json({}, 400)),
    );
    expect(await youtubeXPublishingService.process("job-1")).toEqual({
      state: "FAILED",
      videoId: "youtube-1",
    });
    expect(prisma.publishingJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerUploadState: expect.objectContaining({
            videoId: "youtube-1",
            thumbnailStatus: "TERMINAL_FAILED",
          }),
        }),
      }),
    );
  });

  it("publishes an ordered X thread as chained replies", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue(job("X"));
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ data: { id: "x-1" } }))
      .mockResolvedValueOnce(json({ data: { id: "x-2" } }));
    vi.stubGlobal("fetch", fetch);
    expect(await youtubeXPublishingService.process("job-1")).toMatchObject({
      state: "PUBLISHED",
      postId: "x-1",
    });
    const second = JSON.parse(String((fetch.mock.calls[1]![1] as RequestInit).body));
    expect(second.reply.in_reply_to_tweet_id).toBe("x-1");
  });

  it("resumes X upload after INIT without rerunning INIT", async () => {
    const data = job("X", {
      providerUploadState: {
        uploads: [
          {
            assetId: "image-1",
            mediaId: "media-existing",
            totalBytes: 4,
            chunkSize: 4,
            confirmedSegments: [],
            finalized: false,
            processingStatus: "PENDING",
          },
        ],
        postIds: [],
      },
    });
    data.schedule.contentVariant.visualAssets = [
      {
        marketingAsset: {
          ...video,
          id: "image-1",
          assetType: "IMAGE",
          mimeType: "image/jpeg",
          sizeBytes: 4,
        },
      },
    ];
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(new Uint8Array(4), { status: 206 }))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({ data: { id: "x-1" } }))
      .mockResolvedValueOnce(json({ data: { id: "x-2" } }));
    vi.stubGlobal("fetch", fetch);
    await youtubeXPublishingService.process("job-1");
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(String(fetch.mock.calls[0]![0])).toBe("https://signed.test/file");
  });

  it("resumes only missing X APPEND segments and then FINALIZEs", async () => {
    const data = job("X", {
      providerUploadState: {
        uploads: [
          {
            assetId: "video-asset",
            mediaId: "media-1",
            totalBytes: 4 * 1024 * 1024 + 1,
            chunkSize: 4 * 1024 * 1024,
            confirmedSegments: [0],
            finalized: false,
            processingStatus: "PENDING",
          },
        ],
        postIds: [],
      },
    });
    data.schedule.contentVariant.visualAssets = [{ marketingAsset: video }];
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(new Uint8Array(1), { status: 206 }))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({ data: { id: "x-1" } }))
      .mockResolvedValueOnce(json({ data: { id: "x-2" } }));
    vi.stubGlobal("fetch", fetch);
    await youtubeXPublishingService.process("job-1");
    const append = (fetch.mock.calls[1]![1] as RequestInit).body as FormData;
    expect(append.get("segment_index")).toBe("1");
  });

  it("resumes X STATUS polling after FINALIZE without re-appending media", async () => {
    const data = job("X", {
      providerUploadState: {
        uploads: [
          {
            assetId: "video-asset",
            mediaId: "media-1",
            totalBytes: 1000,
            chunkSize: 1000,
            confirmedSegments: [0],
            finalized: true,
            processingStatus: "PROCESSING",
          },
        ],
        postIds: [],
      },
    });
    data.schedule.contentVariant.visualAssets = [{ marketingAsset: video }];
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ processing_info: { state: "in_progress" } })),
    );
    expect(await youtubeXPublishingService.process("job-1")).toMatchObject({
      state: "PROCESSING",
    });
  });

  it("restarts X INIT only after a media ID is confirmed expired", async () => {
    const data = job("X", {
      providerUploadState: {
        uploads: [
          {
            assetId: "video-asset",
            mediaId: "expired-media",
            totalBytes: 1000,
            chunkSize: 1000,
            confirmedSegments: [0],
            finalized: true,
            processingStatus: "PROCESSING",
          },
        ],
        postIds: [],
      },
    });
    data.schedule.contentVariant.visualAssets = [{ marketingAsset: video }];
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("media expired", { status: 404 })),
    );
    expect(await youtubeXPublishingService.process("job-1")).toMatchObject({
      state: "MEDIA_SESSION_REPLACEMENT_REQUIRED",
    });
    expect(prisma.publishingJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ providerContainerId: null }),
      }),
    );
  });

  it("records partial X thread publication and resumes without duplicating posts", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue(job("X"));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ data: { id: "x-1" } }))
        .mockResolvedValueOnce(json({ detail: "failure" }, 500)),
    );
    expect(await youtubeXPublishingService.process("job-1")).toEqual({
      state: "PARTIALLY_PUBLISHED",
      postIds: ["x-1"],
    });

    prisma.publishingJob.findFirst.mockResolvedValue(
      job("X", {
        status: "PARTIALLY_COMPLETED",
        providerUploadState: { mediaIds: [], postIds: ["x-1"], mediaReady: true },
      }),
    );
    const fetch = vi.fn().mockResolvedValue(json({ data: { id: "x-2" } }));
    vi.stubGlobal("fetch", fetch);
    await youtubeXPublishingService.process("job-1");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry exhausted YouTube quota and marks manual fallback", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue(job("YOUTUBE"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ error: { errors: [{ reason: "quotaExceeded" }] } }, 403)),
    );
    expect(await youtubeXPublishingService.process("job-1")).toEqual({
      state: "MANUAL_FALLBACK_REQUIRED",
    });
    expect(prisma.publishingJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ directPublishAvailable: false }),
      }),
    );
  });

  it("refreshes YouTube OAuth credentials and requeues exactly once", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue(job("YOUTUBE"));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({}, 401))
        .mockResolvedValueOnce(
          json({
            access_token: "youtube-fresh",
            expires_in: 3600,
            scope: "https://www.googleapis.com/auth/youtube.upload",
          }),
        ),
    );
    expect(await youtubeXPublishingService.process("job-1")).toEqual({
      state: "REQUEUED_AFTER_REFRESH",
    });
    expect(credentials.upsertTokens).toHaveBeenCalledWith(
      "connection-1",
      expect.objectContaining({ accessToken: "youtube-fresh" }),
    );

    prisma.publishingJob.findFirst.mockResolvedValue(job("YOUTUBE", { refreshAttemptCount: 1 }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 401)));
    expect(await youtubeXPublishingService.process("job-1")).toEqual({
      state: "FAILED",
    });
  });

  it("refreshes X OAuth credentials and fails terminally when refresh is rejected", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue(job("X"));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({}, 401))
        .mockResolvedValueOnce(
          json({
            access_token: "x-fresh",
            refresh_token: "x-refresh",
            expires_in: 3600,
            scope: "tweet.write media.write offline.access",
          }),
        ),
    );
    expect(await youtubeXPublishingService.process("job-1")).toEqual({
      state: "REQUEUED_AFTER_REFRESH",
    });

    prisma.publishingJob.findFirst.mockResolvedValue(job("X"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({}, 400)),
    );
    expect(await youtubeXPublishingService.process("job-1")).toEqual({
      state: "FAILED",
    });
  });

  it("protects cross-tenant jobs", async () => {
    const data = job("X");
    data.schedule.socialAccount.organisationId = "org-2";
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    await expect(youtubeXPublishingService.process("job-1")).rejects.toThrow("another tenant");
  });

  it("uses manual fallback for X entitlement and rate limits without retry loops", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue(job("X"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 403)));
    expect(await youtubeXPublishingService.process("job-1")).toEqual({
      state: "MANUAL_FALLBACK_REQUIRED",
    });
    expect(prisma.publishingJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          directPublishAvailable: false,
        }),
      }),
    );

    prisma.publishingJob.findFirst.mockResolvedValue(job("X"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 429)));
    expect(await youtubeXPublishingService.process("job-1")).toEqual({
      state: "MANUAL_FALLBACK_REQUIRED",
    });
  });

  it("prevents duplicate publishing through persisted post IDs", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue(job("X", { publishedMediaId: "existing" }));
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await youtubeXPublishingService.process("job-1")).toEqual({
      state: "ALREADY_PUBLISHED",
      postId: "existing",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns the existing job for an idempotent enqueue", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue({ id: "existing" });
    const result = await youtubeXPublishingService.enqueue(
      "brand-1",
      "org-1",
      "content-1",
      {
        contentVariantId: "variant-1",
        socialAccountId: "account-1",
        confirmed: true,
        idempotencyKey: "idempotent-key",
        posts: ["Post"],
        entitlementConfirmed: true,
      },
      "X",
      context,
    );
    expect(result).toEqual({ id: "existing" });
    expect(prisma.publishingJob.create).not.toHaveBeenCalled();
  });

  it("provides an honest manual fallback package without marking content published", async () => {
    prisma.contentVariant.findFirst.mockResolvedValue({
      provider: "YOUTUBE",
      caption: "Description",
      headline: "Title",
      description: "Long description",
      destinationUrl: null,
      thumbnailAssetId: null,
      visualAssets: [{ marketingAsset: video }],
    });
    const result = await youtubeXPublishingService.getFallbackPackage(
      "brand-1",
      "org-1",
      "variant-1",
      context,
    );
    expect(result).toMatchObject({
      status: "Manual publishing required",
      provider: "YOUTUBE",
      title: "Title",
    });
    expect(prisma.contentItem.update).not.toHaveBeenCalled();
  });
});
