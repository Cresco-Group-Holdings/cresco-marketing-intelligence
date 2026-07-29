import type { TikTokCreatorInfo, TikTokPrivacyLevel } from "@/lib/social/tiktok-publishing-adapter";

export const TIKTOK_VIDEO_LIMITS = {
  minDurationSeconds: 3,
  maxFileSizeBytes: 4 * 1024 * 1024 * 1024,
  minWidth: 360,
  minHeight: 640,
  maxCaptionLength: 2_200,
  allowedMimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
  /** TikTok renders full-screen vertical; anything materially wider is rejected upstream. */
  maxAspectRatio: 9 / 16 + 0.01,
} as const;

export type TikTokValidationInput = {
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  caption: string;
  privacyLevel: TikTokPrivacyLevel;
  commercialContent: boolean;
  brandOrganicToggle: boolean;
  brandedContentToggle: boolean;
  audioRightsConfirmed: boolean;
  creatorInfo: TikTokCreatorInfo;
};

export type TikTokValidationResult = { valid: boolean; errors: string[] };

export function validateTikTokVideo(input: TikTokValidationInput): TikTokValidationResult {
  const errors: string[] = [];

  if (!TIKTOK_VIDEO_LIMITS.allowedMimeTypes.includes(input.mimeType as never)) {
    errors.push(`Unsupported video codec or container: ${input.mimeType}.`);
  }
  if (input.sizeBytes > TIKTOK_VIDEO_LIMITS.maxFileSizeBytes) {
    errors.push("Video exceeds TikTok's maximum file size.");
  }

  if (input.width === null || input.height === null) {
    errors.push("Video resolution is unknown, so it cannot be validated for TikTok.");
  } else {
    if (
      input.width < TIKTOK_VIDEO_LIMITS.minWidth ||
      input.height < TIKTOK_VIDEO_LIMITS.minHeight
    ) {
      errors.push("Video resolution is below TikTok's minimum for vertical video.");
    }
    if (input.width / input.height > TIKTOK_VIDEO_LIMITS.maxAspectRatio) {
      errors.push("Video must be vertical (9:16) for TikTok.");
    }
  }

  if (input.durationSeconds === null) {
    errors.push("Video duration is unknown, so it cannot be validated for TikTok.");
  } else {
    if (input.durationSeconds < TIKTOK_VIDEO_LIMITS.minDurationSeconds) {
      errors.push("Video is shorter than TikTok's minimum duration.");
    }
    if (
      input.creatorInfo.maxVideoPostDurationSec > 0 &&
      input.durationSeconds > input.creatorInfo.maxVideoPostDurationSec
    ) {
      errors.push(
        `Video exceeds the ${input.creatorInfo.maxVideoPostDurationSec}s maximum this TikTok account can post.`,
      );
    }
  }

  if (!input.caption.trim()) {
    errors.push("A caption is required.");
  }
  if (input.caption.length > TIKTOK_VIDEO_LIMITS.maxCaptionLength) {
    errors.push("Caption exceeds TikTok's maximum length.");
  }

  if (!input.audioRightsConfirmed) {
    errors.push("Audio rights must be confirmed before publishing to TikTok.");
  }

  if (!input.creatorInfo.privacyLevelOptions.includes(input.privacyLevel)) {
    errors.push("The selected privacy level is not offered by this TikTok account.");
  }

  // TikTok requires at least one disclosure when commercial content is declared.
  if (input.commercialContent && !input.brandOrganicToggle && !input.brandedContentToggle) {
    errors.push("Commercial content requires a brand organic or branded content disclosure.");
  }
  if (input.brandedContentToggle && input.privacyLevel === "SELF_ONLY") {
    errors.push("Branded content cannot be posted with self-only visibility.");
  }

  return { valid: errors.length === 0, errors };
}

export function assertInteractionSettings(
  input: { disableComment: boolean; disableDuet: boolean; disableStitch: boolean },
  creatorInfo: TikTokCreatorInfo,
): { disableComment: boolean; disableDuet: boolean; disableStitch: boolean } {
  // Account-level restrictions always win; a user choice can only be more restrictive.
  return {
    disableComment: creatorInfo.commentDisabled || input.disableComment,
    disableDuet: creatorInfo.duetDisabled || input.disableDuet,
    disableStitch: creatorInfo.stitchDisabled || input.disableStitch,
  };
}
