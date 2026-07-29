import { afterEach, describe, expect, it, vi } from "vitest";
import {
  YouTubePublishingAdapter,
  normaliseYouTubeError,
} from "@/lib/social/youtube-publishing-adapter";
import { XPublishingAdapter, normaliseXError } from "@/lib/social/x-publishing-adapter";

const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });

describe("YouTubePublishingAdapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("initialises a resumable upload with metadata, privacy and audience", async () => {
    const fetch = vi.fn().mockResolvedValue(json({}, 200, { location: "https://upload/session" }));
    vi.stubGlobal("fetch", fetch);
    const url = await new YouTubePublishingAdapter(
      "https://yt.test",
      "https://upload.test",
    ).initialiseUpload({
      accessToken: "token",
      mimeType: "video/mp4",
      sizeBytes: 1000,
      metadata: {
        title: "Short title",
        description: "Description",
        tags: ["brand"],
        categoryId: "22",
        privacyStatus: "private",
        madeForKids: false,
      },
    });
    expect(url).toBe("https://upload/session");
    const body = JSON.parse(String((fetch.mock.calls[0]![1] as RequestInit).body));
    expect(body.status).toMatchObject({ privacyStatus: "private", selfDeclaredMadeForKids: false });
  });

  it("polls processing state and uploads a thumbnail", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json({ items: [{ processingDetails: { processingStatus: "succeeded" } }] }),
      )
      .mockResolvedValueOnce(new Response("thumb", { headers: { "content-type": "image/jpeg" } }))
      .mockResolvedValueOnce(json({}));
    vi.stubGlobal("fetch", fetch);
    const adapter = new YouTubePublishingAdapter("https://yt.test", "https://upload.test");
    expect((await adapter.getProcessingStatus("video-1", "token")).status).toBe("PROCESSED");
    await adapter.uploadThumbnail("video-1", "token", "https://signed/thumb.jpg", "image/jpeg");
    expect(String(fetch.mock.calls[2]![0])).toContain("thumbnails/set");
  });

  it("probes an active session and parses the confirmed provider offset", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(null, { status: 308, headers: { range: "bytes=0-1048575" } }),
        ),
    );
    expect(
      await new YouTubePublishingAdapter().probeUploadSession("https://upload/session", 2_000_000),
    ).toEqual({ state: "ACTIVE", confirmedOffset: 1_048_576 });
  });

  it("recognises completed and expired resumable sessions", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ id: "video-completed" }))
      .mockResolvedValueOnce(new Response(null, { status: 410 }));
    vi.stubGlobal("fetch", fetch);
    const adapter = new YouTubePublishingAdapter();
    expect(await adapter.probeUploadSession("session", 100)).toEqual({
      state: "COMPLETED",
      videoId: "video-completed",
    });
    expect(await adapter.probeUploadSession("expired", 100)).toEqual({
      state: "EXPIRED",
    });
  });

  it("uses exact source and provider Content-Range headers for each chunk", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(new Uint8Array(100), { status: 206 }))
      .mockResolvedValueOnce(new Response(null, { status: 308, headers: { range: "bytes=0-99" } }));
    vi.stubGlobal("fetch", fetch);
    const result = await new YouTubePublishingAdapter().uploadChunk({
      uploadUrl: "session",
      sourceUrl: "source",
      mimeType: "video/mp4",
      start: 0,
      end: 99,
      totalBytes: 200,
    });
    expect(result).toMatchObject({ state: "ACTIVE", confirmedOffset: 100 });
    expect((fetch.mock.calls[0]![1] as RequestInit).headers).toEqual({
      range: "bytes=0-99",
    });
    expect((fetch.mock.calls[1]![1] as RequestInit).headers).toMatchObject({
      "content-range": "bytes 0-99/200",
      "content-length": "100",
    });
  });

  it("treats quota exhaustion as terminal", () => {
    const error = normaliseYouTubeError(403, "quotaExceeded");
    expect(error.code).toBe("QUOTA_EXHAUSTED");
    expect(error.retryable).toBe(false);
  });
});

describe("XPublishingAdapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates text and reply posts", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ data: { id: "post-1" } }));
    vi.stubGlobal("fetch", fetch);
    await new XPublishingAdapter("https://x.test", "https://media.test").createPost({
      accessToken: "token",
      text: "Reply",
      replyToId: "parent-1",
    });
    const body = JSON.parse(String((fetch.mock.calls[0]![1] as RequestInit).body));
    expect(body.reply.in_reply_to_tweet_id).toBe("parent-1");
  });

  it("attaches uploaded media IDs to an X post", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ data: { id: "post-media" } }));
    vi.stubGlobal("fetch", fetch);
    await new XPublishingAdapter("https://x.test", "https://media.test").createPost({
      accessToken: "token",
      text: "Media",
      mediaIds: ["media-1"],
    });
    const body = JSON.parse(String((fetch.mock.calls[0]![1] as RequestInit).body));
    expect(body.media.media_ids).toEqual(["media-1"]);
  });

  it("uploads media using INIT, APPEND, and FINALIZE in order", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ media_id_string: "media-1" }))
      .mockResolvedValueOnce(new Response("binary", { headers: { "content-type": "image/jpeg" } }))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({}));
    vi.stubGlobal("fetch", fetch);
    const result = await new XPublishingAdapter("https://x.test", "https://media.test").uploadMedia(
      {
        accessToken: "token",
        sourceUrl: "https://signed/image.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 100,
        category: "tweet_image",
      },
    );
    expect(result.mediaId).toBe("media-1");
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("exposes resumable X INIT, APPEND, and FINALIZE stages", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ media_id_string: "media-2" }))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({ processing_info: { state: "pending" } }));
    vi.stubGlobal("fetch", fetch);
    const adapter = new XPublishingAdapter("https://x.test", "https://media.test");
    const mediaId = await adapter.initMedia({
      accessToken: "token",
      mimeType: "video/mp4",
      sizeBytes: 20,
      category: "tweet_video",
    });
    await adapter.appendSegment(mediaId, 1, new Uint8Array([1, 2]).buffer, "video/mp4", "token");
    const processing = await adapter.finalizeMedia(mediaId, "token");
    expect(mediaId).toBe("media-2");
    expect(processing?.state).toBe("pending");
    const appendBody = (fetch.mock.calls[1]![1] as RequestInit).body as FormData;
    expect(appendBody.get("segment_index")).toBe("1");
  });

  it("does not retry exhausted entitlement or request quota", () => {
    expect(normaliseXError(403).code).toBe("ENTITLEMENT_MISSING");
    expect(normaliseXError(429).retryable).toBe(false);
    expect(normaliseXError(500).retryable).toBe(true);
  });
});
