import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InstagramProviderError,
  InstagramPublishingAdapter,
  normaliseInstagramError,
} from "@/lib/social/instagram-publishing-adapter";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("InstagramPublishingAdapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates a single image container with alt text", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ id: "container-1" }));
    vi.stubGlobal("fetch", fetch);

    const containerId = await new InstagramPublishingAdapter("https://graph.test").createContainer({
      igUserId: "ig-1",
      accessToken: "token",
      mediaUrls: ["https://signed.test/a.jpg"],
      mediaType: "IMAGE",
      caption: "Caption",
      altText: "Description",
    });

    expect(containerId).toBe("container-1");
    const body = (fetch.mock.calls[0]![1] as RequestInit).body as URLSearchParams;
    expect(body.get("alt_text")).toBe("Description");
    expect(body.get("image_url")).toBe("https://signed.test/a.jpg");
  });

  it("creates child containers before the carousel parent", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "child-1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "child-2" }))
      .mockResolvedValueOnce(jsonResponse({ id: "parent" }));
    vi.stubGlobal("fetch", fetch);

    const containerId = await new InstagramPublishingAdapter("https://graph.test").createContainer({
      igUserId: "ig-1",
      accessToken: "token",
      mediaUrls: ["https://signed.test/a.jpg", "https://signed.test/b.jpg"],
      mediaType: "CAROUSEL",
    });

    expect(containerId).toBe("parent");
    const parentBody = (fetch.mock.calls[2]![1] as RequestInit).body as URLSearchParams;
    expect(parentBody.get("children")).toBe("child-1,child-2");
  });

  it("omits alt text for reels because Meta does not support it", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ id: "container-reel" }));
    vi.stubGlobal("fetch", fetch);

    await new InstagramPublishingAdapter("https://graph.test").createContainer({
      igUserId: "ig-1",
      accessToken: "token",
      mediaUrls: ["https://signed.test/a.mp4"],
      mediaType: "REELS",
      altText: "Ignored",
    });

    const body = (fetch.mock.calls[0]![1] as RequestInit).body as URLSearchParams;
    expect(body.get("media_type")).toBe("REELS");
    expect(body.get("alt_text")).toBeNull();
  });

  it("reports container processing status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status_code: "FINISHED" })));
    const result = await new InstagramPublishingAdapter("https://graph.test").getContainerStatus(
      "c1",
      "token",
    );
    expect(result.status).toBe("FINISHED");
  });

  it("publishes a container and resolves its permalink", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "post-1" }))
      .mockResolvedValueOnce(jsonResponse({ permalink: "https://instagram.com/p/post-1" }));
    vi.stubGlobal("fetch", fetch);

    const adapter = new InstagramPublishingAdapter("https://graph.test");
    const postId = await adapter.publishContainer("ig-1", "c1", "token");
    expect(postId).toBe("post-1");
    expect(await adapter.getPermalink(postId, "token")).toBe("https://instagram.com/p/post-1");
  });

  it("maps provider failures to actionable normalised errors", () => {
    expect(normaliseInstagramError({ message: "Invalid OAuth access token" }, 400).code).toBe(
      "TOKEN_EXPIRED",
    );
    expect(
      normaliseInstagramError({ message: "Application does not have permission" }, 403).code,
    ).toBe("PERMISSION_MISSING");
    expect(normaliseInstagramError({ message: "rate limit reached" }, 429).code).toBe(
      "RATE_LIMITED",
    );
    expect(normaliseInstagramError({ message: "Unsupported aspect ratio" }, 400).code).toBe(
      "UNSUPPORTED_MEDIA",
    );
    expect(normaliseInstagramError({ message: "Server error" }, 500).code).toBe("TRANSIENT");
    expect(normaliseInstagramError({ message: "Server error" }, 500).retryable).toBe(true);
  });

  it("throws a normalised error when container creation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ error: { message: "Invalid OAuth access token" } }, 400)),
    );

    await expect(
      new InstagramPublishingAdapter("https://graph.test").createContainer({
        igUserId: "ig-1",
        accessToken: "expired",
        mediaUrls: ["https://signed.test/a.jpg"],
        mediaType: "IMAGE",
      }),
    ).rejects.toBeInstanceOf(InstagramProviderError);
  });
});
