import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TIKTOK_VIDEO_LIMITS,
  assertInteractionSettings,
  validateTikTokVideo,
} from "@/lib/content/tiktok-video-validation";
import {
  TikTokProviderError,
  TikTokPublishingAdapter,
  normaliseTikTokError,
  type TikTokCreatorInfo,
} from "@/lib/social/tiktok-publishing-adapter";
import { TikTokCredentialAdapter } from "@/lib/social/tiktok-credential-adapter";
import { resetEnvCacheForTests } from "@/lib/environment";

const creatorInfo: TikTokCreatorInfo = {
  creatorUsername: "brand",
  creatorNickname: "Brand",
  privacyLevelOptions: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
  commentDisabled: false,
  duetDisabled: false,
  stitchDisabled: false,
  maxVideoPostDurationSec: 600,
};

const baseVideo = {
  mimeType: "video/mp4",
  sizeBytes: 5_000_000,
  width: 1080,
  height: 1920,
  durationSeconds: 30,
  caption: "A compliant caption",
  privacyLevel: "PUBLIC_TO_EVERYONE" as const,
  commercialContent: false,
  brandOrganicToggle: false,
  brandedContentToggle: false,
  audioRightsConfirmed: true,
  creatorInfo,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("TikTok video validation", () => {
  it("accepts a compliant vertical video", () => {
    expect(validateTikTokVideo(baseVideo)).toEqual({ valid: true, errors: [] });
  });

  it("rejects landscape video, unsupported codecs, and oversized files", () => {
    const landscape = validateTikTokVideo({ ...baseVideo, width: 1920, height: 1080 });
    expect(landscape.errors).toContain("Video must be vertical (9:16) for TikTok.");

    const codec = validateTikTokVideo({ ...baseVideo, mimeType: "video/x-msvideo" });
    expect(codec.valid).toBe(false);

    const oversized = validateTikTokVideo({
      ...baseVideo,
      sizeBytes: TIKTOK_VIDEO_LIMITS.maxFileSizeBytes + 1,
    });
    expect(oversized.errors).toContain("Video exceeds TikTok's maximum file size.");
  });

  it("rejects a duration beyond what the account may post", () => {
    const result = validateTikTokVideo({ ...baseVideo, durationSeconds: 900 });
    expect(result.errors.some((message) => message.includes("600s maximum"))).toBe(true);
  });

  it("rejects a privacy level the account does not offer", () => {
    const result = validateTikTokVideo({ ...baseVideo, privacyLevel: "FOLLOWER_OF_CREATOR" });
    expect(result.errors).toContain(
      "The selected privacy level is not offered by this TikTok account.",
    );
  });

  it("requires a disclosure when commercial content is declared", () => {
    const result = validateTikTokVideo({ ...baseVideo, commercialContent: true });
    expect(result.errors).toContain(
      "Commercial content requires a brand organic or branded content disclosure.",
    );

    const disclosed = validateTikTokVideo({
      ...baseVideo,
      commercialContent: true,
      brandOrganicToggle: true,
    });
    expect(disclosed.valid).toBe(true);
  });

  it("rejects branded content posted as self-only", () => {
    const result = validateTikTokVideo({
      ...baseVideo,
      privacyLevel: "SELF_ONLY",
      commercialContent: true,
      brandedContentToggle: true,
    });
    expect(result.errors).toContain("Branded content cannot be posted with self-only visibility.");
  });

  it("requires confirmed audio rights and a caption", () => {
    expect(validateTikTokVideo({ ...baseVideo, audioRightsConfirmed: false }).valid).toBe(false);
    expect(validateTikTokVideo({ ...baseVideo, caption: "   " }).valid).toBe(false);
  });

  it("never relaxes account-level interaction restrictions", () => {
    const restricted = assertInteractionSettings(
      { disableComment: false, disableDuet: false, disableStitch: false },
      { ...creatorInfo, commentDisabled: true, duetDisabled: true, stitchDisabled: true },
    );
    expect(restricted).toEqual({ disableComment: true, disableDuet: true, disableStitch: true });

    const userTightened = assertInteractionSettings(
      { disableComment: true, disableDuet: false, disableStitch: false },
      creatorInfo,
    );
    expect(userTightened.disableComment).toBe(true);
  });
});

describe("TikTokPublishingAdapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads creator info including the authoritative privacy options", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: {
            creator_username: "brand",
            creator_nickname: "Brand",
            privacy_level_options: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
            comment_disabled: true,
            duet_disabled: false,
            stitch_disabled: false,
            max_video_post_duration_sec: 600,
          },
          error: { code: "ok" },
        }),
      ),
    );

    const info = await new TikTokPublishingAdapter("https://tiktok.test").getCreatorInfo("token");
    expect(info.privacyLevelOptions).toEqual(["PUBLIC_TO_EVERYONE", "SELF_ONLY"]);
    expect(info.commentDisabled).toBe(true);
  });

  it("initialises a direct post with the user's exact settings", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ data: { publish_id: "publish-1" } }));
    vi.stubGlobal("fetch", fetch);

    const publishId = await new TikTokPublishingAdapter("https://tiktok.test").initDirectPost({
      accessToken: "token",
      videoUrl: "https://signed.test/video.mp4",
      settings: {
        title: "Caption",
        privacyLevel: "SELF_ONLY",
        disableComment: true,
        disableDuet: false,
        disableStitch: true,
        brandContentToggle: false,
        brandOrganicToggle: true,
      },
    });

    expect(publishId).toBe("publish-1");
    const body = JSON.parse(String((fetch.mock.calls[0]![1] as RequestInit).body));
    expect(body.post_info.privacy_level).toBe("SELF_ONLY");
    expect(body.post_info.disable_comment).toBe(true);
    expect(body.post_info.brand_organic_toggle).toBe(true);
    expect(body.source_info).toEqual({
      source: "PULL_FROM_URL",
      video_url: "https://signed.test/video.mp4",
    });
  });

  it("reports processing and completed publish status", async () => {
    const adapter = new TikTokPublishingAdapter("https://tiktok.test");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ data: { status: "PROCESSING_UPLOAD" } })),
    );
    expect((await adapter.getPublishStatus("p1", "token")).status).toBe("PROCESSING_UPLOAD");

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({
            data: { status: "PUBLISH_COMPLETE", publicaly_available_post_id: ["post-1"] },
          }),
        ),
    );
    const complete = await adapter.getPublishStatus("p1", "token");
    expect(complete).toMatchObject({ status: "PUBLISH_COMPLETE", postId: "post-1" });
  });

  it("surfaces moderation rejection through the status payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ data: { status: "FAILED", fail_reason: "content moderation" } }),
        ),
    );
    const result = await new TikTokPublishingAdapter("https://tiktok.test").getPublishStatus(
      "p1",
      "token",
    );
    expect(result).toMatchObject({ status: "FAILED", failReason: "content moderation" });
  });

  it("maps documented provider errors onto actionable codes", () => {
    expect(
      normaliseTikTokError("unaudited_client_can_only_post_to_private_accounts", undefined, 403)
        .code,
    ).toBe("APP_NOT_APPROVED");
    expect(normaliseTikTokError("privacy_level_option_mismatch", undefined, 400).code).toBe(
      "PRIVACY_INVALID",
    );
    expect(normaliseTikTokError("scope_not_authorized", undefined, 401).code).toBe("SCOPE_MISSING");
    expect(normaliseTikTokError("access_token_invalid", undefined, 401).code).toBe("TOKEN_EXPIRED");
    expect(normaliseTikTokError("url_ownership_unverified", undefined, 400).code).toBe(
      "URL_OWNERSHIP_UNVERIFIED",
    );
    expect(normaliseTikTokError("spam_risk_too_many_pending_share", undefined, 403).code).toBe(
      "ACCOUNT_NOT_ELIGIBLE",
    );
    expect(normaliseTikTokError("rate_limit_exceeded", undefined, 429).retryable).toBe(true);
    expect(normaliseTikTokError(undefined, "boom", 500).retryable).toBe(true);
    expect(normaliseTikTokError("duration_check_failed", undefined, 400).code).toBe(
      "UNSUPPORTED_VIDEO",
    );
  });

  it("throws a normalised error when the API returns a failure envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: "scope_not_authorized", message: "no scope" } }, 401),
        ),
    );
    await expect(
      new TikTokPublishingAdapter("https://tiktok.test").getCreatorInfo("token"),
    ).rejects.toBeInstanceOf(TikTokProviderError);
  });

  it("cancels an in-flight publish", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ data: {} }));
    vi.stubGlobal("fetch", fetch);
    await new TikTokPublishingAdapter("https://tiktok.test").cancelPublish("publish-1", "token");
    expect(String(fetch.mock.calls[0]![0])).toContain("/post/publish/cancel/");
  });
});

describe("TikTokCredentialAdapter", () => {
  beforeEach(() => {
    process.env.TIKTOK_CLIENT_KEY = "client-key";
    process.env.TIKTOK_CLIENT_SECRET = "client-secret";
    resetEnvCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetEnvCacheForTests();
  });

  it("refreshes tokens using the OAuth refresh grant", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_in: 86_400,
          scope: "video.publish",
        }),
      );
    vi.stubGlobal("fetch", fetch);

    const tokens = await new TikTokCredentialAdapter(
      "https://tiktok.test/token",
    ).refreshAccessToken({
      refreshToken: "old-refresh",
    });

    expect(tokens.accessToken).toBe("new-access");
    expect(tokens.refreshToken).toBe("new-refresh");
    expect(tokens.scopes).toContain("video.publish");
  });

  it("fails safely when TikTok rejects the refresh", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: "invalid_grant", error_description: "expired" }, 400),
        ),
    );
    await expect(
      new TikTokCredentialAdapter("https://tiktok.test/token").refreshAccessToken({
        refreshToken: "old",
      }),
    ).rejects.toBeInstanceOf(TikTokProviderError);
  });
});
