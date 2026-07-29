import { afterEach, describe, expect, it, vi } from "vitest";
import { InstagramPublishingAdapter } from "@/lib/social/instagram-publishing-adapter";

describe("InstagramPublishingAdapter", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("publishes a single image once and returns its permalink", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "container-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "post-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ permalink: "https://instagram.com/p/post-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const result = await new InstagramPublishingAdapter("https://graph.test").publish({ igUserId: "ig-1", accessToken: "token", mediaUrls: ["https://signed.test/a.jpg"], mediaType: "IMAGE", caption: "Caption", altText: "Description" });
    expect(result).toEqual({ containerId: "container-1", postId: "post-1", permalink: "https://instagram.com/p/post-1" });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("creates child containers before a carousel parent", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "child-1" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "child-2" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "parent" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "post" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ permalink: "https://instagram.com/p/post" })));
    vi.stubGlobal("fetch", fetch);
    await new InstagramPublishingAdapter("https://graph.test").publish({ igUserId: "ig-1", accessToken: "token", mediaUrls: ["https://signed.test/a.jpg", "https://signed.test/b.jpg"], mediaType: "CAROUSEL" });
    expect(fetch).toHaveBeenCalledTimes(5);
  });
  it("normalizes expired-token errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Invalid OAuth access token" } }), { status: 400 })));
    await expect(new InstagramPublishingAdapter("https://graph.test").publish({ igUserId: "ig-1", accessToken: "expired", mediaUrls: ["https://signed.test/a.jpg"], mediaType: "IMAGE" })).rejects.toMatchObject({ message: "Instagram token expired or is invalid." });
  });
});
