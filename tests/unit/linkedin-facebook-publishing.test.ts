import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LinkedInPublishingAdapter,
  normaliseLinkedInError,
} from "@/lib/social/linkedin-publishing-adapter";
import {
  FacebookPublishingAdapter,
  normaliseFacebookError,
} from "@/lib/social/facebook-publishing-adapter";

const response = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });

describe("LinkedInPublishingAdapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("publishes a member text post with the member URN", async () => {
    const fetch = vi.fn().mockResolvedValue(response({}, 201, { "x-restli-id": "urn:li:share:1" }));
    vi.stubGlobal("fetch", fetch);
    const id = await new LinkedInPublishingAdapter("https://li.test").createPost({
      authorUrn: "urn:li:person:123",
      commentary: "Member post",
      accessToken: "token",
    });
    expect(id).toBe("urn:li:share:1");
    const body = JSON.parse(String((fetch.mock.calls[0]![1] as RequestInit).body));
    expect(body.author).toBe("urn:li:person:123");
  });

  it("publishes an organisation post with its explicit organisation URN", async () => {
    const fetch = vi.fn().mockResolvedValue(response({}, 201, { "x-restli-id": "urn:li:share:2" }));
    vi.stubGlobal("fetch", fetch);
    await new LinkedInPublishingAdapter("https://li.test").createPost({
      authorUrn: "urn:li:organization:456",
      commentary: "Organisation post",
      accessToken: "token",
    });
    const body = JSON.parse(String((fetch.mock.calls[0]![1] as RequestInit).body));
    expect(body.author).toBe("urn:li:organization:456");
  });

  it("initialises image, video, and document uploads", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        response({ value: { uploadUrl: "https://upload/image", image: "urn:li:image:1" } }),
      )
      .mockResolvedValueOnce(
        response({
          value: {
            uploadInstructions: [{ uploadUrl: "https://upload/video" }],
            video: "urn:li:video:1",
          },
        }),
      )
      .mockResolvedValueOnce(
        response({
          value: { uploadUrl: "https://upload/document", document: "urn:li:document:1" },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const adapter = new LinkedInPublishingAdapter("https://li.test");
    expect((await adapter.initialiseUpload("IMAGE", "urn:li:person:1", "token")).assetUrn).toBe(
      "urn:li:image:1",
    );
    expect((await adapter.initialiseUpload("VIDEO", "urn:li:person:1", "token")).assetUrn).toBe(
      "urn:li:video:1",
    );
    expect((await adapter.initialiseUpload("DOCUMENT", "urn:li:person:1", "token")).assetUrn).toBe(
      "urn:li:document:1",
    );
  });

  it("maps permission, token, rate, and transient errors", () => {
    expect(normaliseLinkedInError(401).code).toBe("TOKEN_EXPIRED");
    expect(normaliseLinkedInError(403).code).toBe("PERMISSION_MISSING");
    expect(normaliseLinkedInError(429).retryable).toBe(true);
    expect(normaliseLinkedInError(500).retryable).toBe(true);
    expect(normaliseLinkedInError(400, "invalid organization author").code).toBe("INVALID_AUTHOR");
  });
});

describe("FacebookPublishingAdapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("publishes text and link posts to the Page feed", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ id: "page_post_1" }));
    vi.stubGlobal("fetch", fetch);
    const id = await new FacebookPublishingAdapter("https://fb.test").publishTextOrLink({
      pageId: "page-1",
      accessToken: "page-token",
      message: "Message",
      link: "https://example.com",
    });
    expect(id).toBe("page_post_1");
    expect(String(fetch.mock.calls[0]![0])).toContain("/page-1/feed");
  });

  it("uploads multiple photos unpublished before attaching them to one feed post", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ id: "photo-1" }))
      .mockResolvedValueOnce(response({ id: "photo-2" }))
      .mockResolvedValueOnce(response({ id: "post-1" }));
    vi.stubGlobal("fetch", fetch);
    const id = await new FacebookPublishingAdapter("https://fb.test").publishMultiplePhotos({
      pageId: "page-1",
      accessToken: "token",
      message: "Album",
      urls: ["https://signed/a.jpg", "https://signed/b.jpg"],
    });
    expect(id).toBe("post-1");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("uses the official Page Reels edge when explicitly selected", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ id: "reel-1" }));
    vi.stubGlobal("fetch", fetch);
    await new FacebookPublishingAdapter("https://fb.test").publishVideo({
      pageId: "page-1",
      accessToken: "token",
      description: "Reel",
      fileUrl: "https://signed/video.mp4",
      reel: true,
    });
    expect(String(fetch.mock.calls[0]![0])).toContain("/page-1/video_reels");
  });

  it("maps Meta Page provider errors", () => {
    expect(normaliseFacebookError(400, { code: 190 }).code).toBe("TOKEN_EXPIRED");
    expect(normaliseFacebookError(403, { code: 200 }).code).toBe("PERMISSION_MISSING");
    expect(normaliseFacebookError(400, { code: 368 }).code).toBe("POLICY_REJECTED");
    expect(normaliseFacebookError(429).retryable).toBe(true);
    expect(normaliseFacebookError(500).retryable).toBe(true);
  });
});
