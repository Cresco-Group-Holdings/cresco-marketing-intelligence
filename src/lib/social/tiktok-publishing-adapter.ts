export type TikTokPrivacyLevel =
  "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";

/**
 * Creator options are authoritative. TikTok rejects any privacy level that the
 * creator's own account does not currently offer.
 */
export type TikTokCreatorInfo = {
  creatorUsername: string;
  creatorNickname: string;
  privacyLevelOptions: TikTokPrivacyLevel[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec: number;
};

export type TikTokPostSettings = {
  title: string;
  privacyLevel: TikTokPrivacyLevel;
  disableComment: boolean;
  disableDuet: boolean;
  disableStitch: boolean;
  videoCoverTimestampMs?: number;
  brandContentToggle: boolean;
  brandOrganicToggle: boolean;
};

export type TikTokPublishStatus = "PROCESSING_UPLOAD" | "PUBLISH_COMPLETE" | "FAILED";

export type TikTokErrorCode =
  | "APP_NOT_APPROVED"
  | "ACCOUNT_NOT_ELIGIBLE"
  | "SCOPE_MISSING"
  | "PRIVACY_INVALID"
  | "UNSUPPORTED_VIDEO"
  | "UPLOAD_FAILED"
  | "MODERATION_REJECTED"
  | "RATE_LIMITED"
  | "TOKEN_EXPIRED"
  | "URL_OWNERSHIP_UNVERIFIED"
  | "TRANSIENT"
  | "PROVIDER_ERROR";

export class TikTokProviderError extends Error {
  constructor(
    readonly code: TikTokErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "TikTokProviderError";
  }
}

/** Maps documented TikTok `error.code` values onto actionable, safe messages. */
export function normaliseTikTokError(
  code: string | undefined,
  message: string | undefined,
  httpStatus: number,
) {
  const detail = message ?? "TikTok request failed.";
  switch (code) {
    case "unaudited_client_can_only_post_to_private_accounts":
      return new TikTokProviderError(
        "APP_NOT_APPROVED",
        "This application has not completed TikTok's audit, so it can only publish privately.",
        false,
      );
    case "privacy_level_option_mismatch":
      return new TikTokProviderError(
        "PRIVACY_INVALID",
        "The selected privacy level is no longer offered by this TikTok account. Reconfirm the posting settings.",
        false,
      );
    case "scope_not_authorized":
      return new TikTokProviderError(
        "SCOPE_MISSING",
        "The TikTok account has not granted the video publishing scope.",
        false,
      );
    case "access_token_invalid":
      return new TikTokProviderError(
        "TOKEN_EXPIRED",
        "TikTok credentials expired and must be refreshed.",
        true,
      );
    case "url_ownership_unverified":
      return new TikTokProviderError(
        "URL_OWNERSHIP_UNVERIFIED",
        "The media URL prefix is not verified with TikTok, so pull-from-URL is unavailable.",
        false,
      );
    case "spam_risk_too_many_pending_share":
    case "spam_risk_user_banned_from_posting":
      return new TikTokProviderError(
        "ACCOUNT_NOT_ELIGIBLE",
        "TikTok is currently blocking new posts for this account.",
        false,
      );
    case "rate_limit_exceeded":
      return new TikTokProviderError(
        "RATE_LIMITED",
        "TikTok rate limit reached. The publish will be retried.",
        true,
      );
    case "file_format_check_failed":
    case "duration_check_failed":
    case "video_pull_failed":
      return new TikTokProviderError(
        "UNSUPPORTED_VIDEO",
        "TikTok rejected the video file or its duration.",
        false,
      );
    default:
      break;
  }

  if (httpStatus === 429) {
    return new TikTokProviderError(
      "RATE_LIMITED",
      "TikTok rate limit reached. The publish will be retried.",
      true,
    );
  }
  if (httpStatus >= 500) {
    return new TikTokProviderError(
      "TRANSIENT",
      "TikTok is temporarily unavailable. The publish will be retried.",
      true,
    );
  }
  return new TikTokProviderError("PROVIDER_ERROR", detail, false);
}

type TikTokEnvelope<T> = { data?: T; error?: { code?: string; message?: string } };

export class TikTokPublishingAdapter {
  constructor(private readonly baseUrl = "https://open.tiktokapis.com/v2") {}

  private async call<T>(path: string, accessToken: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json; charset=UTF-8",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = (await response.json()) as TikTokEnvelope<T>;
    const errorCode = payload.error?.code;
    if (!response.ok || (errorCode && errorCode !== "ok")) {
      throw normaliseTikTokError(errorCode, payload.error?.message, response.status);
    }
    return payload.data as T;
  }

  async getCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
    const data = await this.call<{
      creator_username: string;
      creator_nickname: string;
      privacy_level_options: TikTokPrivacyLevel[];
      comment_disabled: boolean;
      duet_disabled: boolean;
      stitch_disabled: boolean;
      max_video_post_duration_sec: number;
    }>("/post/publish/creator_info/query/", accessToken);

    return {
      creatorUsername: data.creator_username,
      creatorNickname: data.creator_nickname,
      privacyLevelOptions: data.privacy_level_options ?? [],
      commentDisabled: Boolean(data.comment_disabled),
      duetDisabled: Boolean(data.duet_disabled),
      stitchDisabled: Boolean(data.stitch_disabled),
      maxVideoPostDurationSec: data.max_video_post_duration_sec ?? 0,
    };
  }

  /** Initialises a direct post using a verified pull-from-URL source. Returns the publish id. */
  async initDirectPost(input: {
    accessToken: string;
    settings: TikTokPostSettings;
    videoUrl: string;
  }): Promise<string> {
    const data = await this.call<{ publish_id: string }>(
      "/post/publish/video/init/",
      input.accessToken,
      {
        post_info: {
          title: input.settings.title,
          privacy_level: input.settings.privacyLevel,
          disable_comment: input.settings.disableComment,
          disable_duet: input.settings.disableDuet,
          disable_stitch: input.settings.disableStitch,
          brand_content_toggle: input.settings.brandContentToggle,
          brand_organic_toggle: input.settings.brandOrganicToggle,
          ...(input.settings.videoCoverTimestampMs !== undefined
            ? { video_cover_timestamp_ms: input.settings.videoCoverTimestampMs }
            : {}),
        },
        source_info: { source: "PULL_FROM_URL", video_url: input.videoUrl },
      },
    );
    return data.publish_id;
  }

  async getPublishStatus(
    publishId: string,
    accessToken: string,
  ): Promise<{ status: TikTokPublishStatus; postId: string | null; failReason: string | null }> {
    const data = await this.call<{
      status: string;
      publicaly_available_post_id?: string[];
      fail_reason?: string;
    }>("/post/publish/status/fetch/", accessToken, { publish_id: publishId });

    const status: TikTokPublishStatus =
      data.status === "PUBLISH_COMPLETE"
        ? "PUBLISH_COMPLETE"
        : data.status === "FAILED"
          ? "FAILED"
          : "PROCESSING_UPLOAD";

    return {
      status,
      postId: data.publicaly_available_post_id?.[0] ?? null,
      failReason: data.fail_reason ?? null,
    };
  }

  async cancelPublish(publishId: string, accessToken: string): Promise<void> {
    await this.call("/post/publish/cancel/", accessToken, { publish_id: publishId });
  }
}
