import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  publishingJob: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  publishingAttempt: { findFirst: vi.fn(), create: vi.fn() },
  contentSchedule: { create: vi.fn(), update: vi.fn() },
  contentItem: { findFirst: vi.fn(), update: vi.fn() },
  contentVariant: { findFirst: vi.fn() },
  socialAccount: { findFirst: vi.fn() },
}));
const credentials = vi.hoisted(() => ({ readTokens: vi.fn(), upsertTokens: vi.fn() }));
const linkedInRefresh = vi.hoisted(() => vi.fn());
const metaRefresh = vi.hoisted(() => vi.fn());
const storage = vi.hoisted(() => ({
  createSignedUrl: vi
    .fn()
    .mockResolvedValue({ url: "https://signed.test/a.jpg", expiresAt: new Date() }),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma }));
vi.mock("@/server/services/social-credential-service", () => ({
  socialCredentialService: credentials,
}));
vi.mock("@/lib/social/linkedin-credential-adapter", () => ({
  linkedInCredentialAdapter: { refreshAccessToken: linkedInRefresh },
}));
vi.mock("@/lib/social/meta-credential-adapter", () => ({
  metaCredentialAdapter: { refreshAccessToken: metaRefresh },
}));
vi.mock("@/lib/storage/supabase-storage-provider", () => ({
  createObjectStorageProvider: () => storage,
}));
vi.mock("@/server/services/audit-service", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: { getById: vi.fn().mockResolvedValue({ projectId: "project-1" }) },
}));

import { linkedInFacebookPublishingService } from "@/server/services/linkedin-facebook-publishing-service";

const context = { organisationId: "org-1", userProfileId: "user-1" } as never;
const asset = {
  id: "asset-1",
  assetType: "IMAGE",
  mimeType: "image/jpeg",
  status: "READY",
  approvedForMarketing: true,
  licenceExpiresAt: null,
  storageKey: "asset.jpg",
  title: "Image",
};

function job(provider: "LINKEDIN" | "FACEBOOK", overrides: Record<string, unknown> = {}) {
  const settings =
    provider === "LINKEDIN"
      ? { provider, authorType: "MEMBER", authorId: "member-1" }
      : { provider, pageId: "page-1", publishAsReel: false };
  return {
    id: "job-1",
    organisationId: "org-1",
    projectId: "project-1",
    brandId: "brand-1",
    contentScheduleId: "schedule-1",
    status: "QUEUED",
    attemptCount: 0,
    maxAttempts: 3,
    publishedMediaId: null,
    providerContainerId: null,
    providerUploadState: null,
    pollingAttemptCount: 0,
    refreshAttemptCount: 0,
    providerSettings: settings,
    schedule: {
      id: "schedule-1",
      organisationId: "org-1",
      brandId: "brand-1",
      contentItemId: "content-1",
      contentItem: { status: "APPROVED" },
      contentVariant: {
        provider,
        caption: "Caption",
        headline: "Headline",
        description: "Description",
        destinationUrl: null,
        visualAssets: [{ marketingAsset: asset }],
      },
      socialAccount: {
        organisationId: "org-1",
        brandId: "brand-1",
        socialConnectionId: "connection-1",
        socialConnection: {},
      },
    },
    ...overrides,
  };
}

describe("LinkedIn/Facebook durable publishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    credentials.readTokens.mockResolvedValue({ accessToken: "token" });
    prisma.publishingJob.update.mockResolvedValue({});
    prisma.publishingAttempt.findFirst.mockResolvedValue(null);
    prisma.publishingAttempt.create.mockResolvedValue({});
    prisma.contentSchedule.update.mockResolvedValue({});
    prisma.contentItem.update.mockResolvedValue({});
  });

  it("publishes a Facebook Page post and stores its post id", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue(job("FACEBOOK"));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "fb-post-1" })))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ permalink_url: "https://facebook.com/fb-post-1" })),
        ),
    );
    expect(await linkedInFacebookPublishingService.process("job-1")).toMatchObject({
      state: "PUBLISHED",
      postId: "fb-post-1",
    });
  });

  it("uploads LinkedIn media before publishing a member post", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue(job("LINKEDIN"));
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: { uploadUrl: "https://upload.test/image", image: "urn:li:image:1" },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response("binary", { headers: { "content-type": "image/jpeg" } }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(
        new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:1" } }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await linkedInFacebookPublishingService.process("job-1")).toMatchObject({
      state: "PUBLISHED",
      postId: "urn:li:share:1",
    });
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("does not duplicate a provider post during state reconciliation", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue(
      job("FACEBOOK", { publishedMediaId: "fb-post-existing" }),
    );
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await linkedInFacebookPublishingService.process("job-1")).toEqual({
      state: "ALREADY_PUBLISHED",
      postId: "fb-post-existing",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requeues a transient provider failure", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue(job("FACEBOOK"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: {} }), { status: 500 })),
    );
    expect(await linkedInFacebookPublishingService.process("job-1")).toEqual({
      state: "RETRYING",
    });
  });

  it("rejects a cross-tenant account reference", async () => {
    const data = job("FACEBOOK");
    data.schedule.socialAccount.organisationId = "org-2";
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    await expect(linkedInFacebookPublishingService.process("job-1")).rejects.toThrow(
      "another tenant",
    );
  });

  it("polls a persisted LinkedIn document without uploading it again", async () => {
    const data = job("LINKEDIN", {
      providerUploadState: [
        {
          assetId: "asset-1",
          kind: "DOCUMENT",
          assetUrn: "urn:li:document:1",
          status: "PROCESSING",
        },
      ],
    });
    data.schedule.contentVariant.visualAssets = [
      { marketingAsset: { ...asset, assetType: "DOCUMENT", mimeType: "application/pdf" } },
    ];
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "PROCESSING" })));
    vi.stubGlobal("fetch", fetch);

    expect(await linkedInFacebookPublishingService.process("job-1")).toMatchObject({
      state: "PROCESSING",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });

  it("publishes after a persisted LinkedIn video becomes AVAILABLE", async () => {
    const data = job("LINKEDIN", {
      providerUploadState: [
        {
          assetId: "asset-1",
          kind: "VIDEO",
          assetUrn: "urn:li:video:1",
          status: "PROCESSING",
        },
      ],
    });
    data.schedule.contentVariant.visualAssets = [
      { marketingAsset: { ...asset, assetType: "VIDEO", mimeType: "video/mp4" } },
    ];
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ status: "AVAILABLE" })))
        .mockResolvedValueOnce(
          new Response(null, {
            status: 201,
            headers: { "x-restli-id": "urn:li:share:video" },
          }),
        ),
    );

    expect(await linkedInFacebookPublishingService.process("job-1")).toMatchObject({
      state: "PUBLISHED",
      postId: "urn:li:share:video",
    });
  });

  it("creates one ordered multi-image LinkedIn post from persisted uploads", async () => {
    const data = job("LINKEDIN", {
      providerUploadState: [
        { assetId: "a1", kind: "IMAGE", assetUrn: "urn:li:image:1", status: "AVAILABLE" },
        { assetId: "a2", kind: "IMAGE", assetUrn: "urn:li:image:2", status: "AVAILABLE" },
      ],
    });
    data.schedule.contentVariant.visualAssets = [
      { altText: "First", marketingAsset: { ...asset, id: "a1" } },
      { altText: "Second", marketingAsset: { ...asset, id: "a2" } },
    ] as never;
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    const fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 201,
        headers: { "x-restli-id": "urn:li:share:multi" },
      }),
    );
    vi.stubGlobal("fetch", fetch);

    await linkedInFacebookPublishingService.process("job-1");
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetch.mock.calls[0]![1] as RequestInit).body));
    expect(body.content.multiImage.images).toEqual([
      { id: "urn:li:image:1", altText: "First" },
      { id: "urn:li:image:2", altText: "Second" },
    ]);
  });

  it("resumes a partial multi-image upload without duplicating the completed image", async () => {
    const data = job("LINKEDIN", {
      providerUploadState: [
        { assetId: "a1", kind: "IMAGE", assetUrn: "urn:li:image:1", status: "AVAILABLE" },
      ],
    });
    data.schedule.contentVariant.visualAssets = [
      { marketingAsset: { ...asset, id: "a1" } },
      { marketingAsset: { ...asset, id: "a2", storageKey: "a2.jpg" } },
    ];
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: { uploadUrl: "https://upload/a2", image: "urn:li:image:2" },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response("source", { headers: { "content-type": "image/jpeg" } }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 201,
          headers: { "x-restli-id": "urn:li:share:multi" },
        }),
      );
    vi.stubGlobal("fetch", fetch);

    await linkedInFacebookPublishingService.process("job-1");
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(
      prisma.publishingJob.update.mock.calls.some((call) =>
        JSON.stringify(call[0]).includes("urn:li:image:2"),
      ),
    ).toBe(true);
  });

  it("fails a partial multi-image upload safely and preserves completed upload state", async () => {
    const data = job("LINKEDIN", {
      providerUploadState: [
        { assetId: "a1", kind: "IMAGE", assetUrn: "urn:li:image:1", status: "AVAILABLE" },
      ],
    });
    data.schedule.contentVariant.visualAssets = [
      { marketingAsset: { ...asset, id: "a1" } },
      { marketingAsset: { ...asset, id: "a2", storageKey: "a2.jpg" } },
    ];
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              value: { uploadUrl: "https://upload/a2", image: "urn:li:image:2" },
            }),
          ),
        )
        .mockResolvedValueOnce(
          new Response("source", { headers: { "content-type": "image/jpeg" } }),
        )
        .mockResolvedValueOnce(new Response("failed", { status: 500 })),
    );

    expect(await linkedInFacebookPublishingService.process("job-1")).toEqual({
      state: "RETRYING",
    });
    expect(prisma.contentItem.update).not.toHaveBeenCalled();
  });

  it("reconciles a persisted Facebook video without uploading it twice", async () => {
    const data = job("FACEBOOK", { providerContainerId: "video-1" });
    data.schedule.contentVariant.visualAssets = [
      { marketingAsset: { ...asset, assetType: "VIDEO", mimeType: "video/mp4" } },
    ];
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: { video_status: "ready" },
            post_id: "fb-post-video",
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ permalink_url: "https://facebook/video" })),
      );
    vi.stubGlobal("fetch", fetch);

    expect(await linkedInFacebookPublishingService.process("job-1")).toMatchObject({
      state: "PUBLISHED",
      postId: "fb-post-video",
    });
    expect(storage.createSignedUrl).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("requeues a Facebook Reel while provider processing is in progress", async () => {
    const data = job("FACEBOOK", {
      providerContainerId: "reel-1",
      providerSettings: { provider: "FACEBOOK", pageId: "page-1", publishAsReel: true },
    });
    data.schedule.contentVariant.visualAssets = [
      { marketingAsset: { ...asset, assetType: "VIDEO", mimeType: "video/mp4" } },
    ];
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ status: { video_status: "processing" } })),
        ),
    );
    expect(await linkedInFacebookPublishingService.process("job-1")).toMatchObject({
      state: "PROCESSING",
      uploadId: "reel-1",
    });
  });

  it("refreshes an expired LinkedIn token and requeues exactly once", async () => {
    const data = job("LINKEDIN");
    prisma.publishingJob.findFirst.mockResolvedValue(data);
    credentials.readTokens.mockResolvedValue({
      accessToken: "expired",
      refreshToken: "refresh",
    });
    linkedInRefresh.mockResolvedValue({
      accessToken: "fresh",
      refreshToken: "new-refresh",
      scopes: [],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));

    expect(await linkedInFacebookPublishingService.process("job-1")).toEqual({
      state: "REQUEUED_AFTER_REFRESH",
    });
    expect(credentials.upsertTokens).toHaveBeenCalledWith(
      "connection-1",
      expect.objectContaining({ accessToken: "fresh" }),
    );
  });

  it("refreshes an expired Facebook token and prevents an infinite refresh loop", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue(job("FACEBOOK"));
    metaRefresh.mockResolvedValue({ accessToken: "fresh", scopes: [] });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            new Response(JSON.stringify({ error: { code: 190, message: "expired" } }), {
              status: 400,
            }),
          ),
        ),
    );
    expect(await linkedInFacebookPublishingService.process("job-1")).toEqual({
      state: "REQUEUED_AFTER_REFRESH",
    });

    prisma.publishingJob.findFirst.mockResolvedValue(job("FACEBOOK", { refreshAttemptCount: 1 }));
    expect(await linkedInFacebookPublishingService.process("job-1")).toEqual({
      state: "FAILED",
    });
    expect(metaRefresh).toHaveBeenCalledTimes(1);
  });

  it("returns an existing job for an idempotent enqueue", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue({ id: "existing" });
    expect(
      await linkedInFacebookPublishingService.enqueue(
        "brand-1",
        "org-1",
        "content-1",
        {
          contentVariantId: "variant-1",
          socialAccountId: "account-1",
          idempotencyKey: "same-key",
          settings: { provider: "FACEBOOK", pageId: "page-1", publishAsReel: false },
        },
        context,
      ),
    ).toEqual({ id: "existing" });
    expect(prisma.publishingJob.create).not.toHaveBeenCalled();
  });

  it("rejects organisation publishing without the organisation permission", async () => {
    prisma.publishingJob.findFirst.mockResolvedValue(null);
    prisma.contentItem.findFirst.mockResolvedValue({ id: "content-1" });
    prisma.contentVariant.findFirst.mockResolvedValue({
      id: "variant-1",
      validationErrors: null,
      visualAssets: [],
    });
    prisma.socialAccount.findFirst.mockResolvedValue({
      accountType: "LINKEDIN_ORGANISATION",
      providerAccountId: "org-1",
      socialConnection: { grantedScopes: ["w_member_social"] },
    });
    await expect(
      linkedInFacebookPublishingService.enqueue(
        "brand-1",
        "org-1",
        "content-1",
        {
          contentVariantId: "variant-1",
          socialAccountId: "account-1",
          idempotencyKey: "org-key",
          settings: { provider: "LINKEDIN", authorType: "ORGANISATION", authorId: "org-1" },
        },
        context,
      ),
    ).rejects.toThrow("w_organization_social");
  });
});
