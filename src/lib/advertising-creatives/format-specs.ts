import type { AdvertisingChannelType, AdvertisingCreativeFormatType } from "@prisma/client";

export type FormatSpec = {
  aspectRatio?: string;
  resolution?: string;
  maxFileSizeBytes?: number;
  maxDurationSeconds?: number;
  textLimits?: Record<string, number>;
  audioRequired?: boolean;
  subtitlesRequired?: boolean;
  thumbnailRequired?: boolean;
  safeZones?: Record<string, unknown>;
};

export const FORMAT_SPECS: Record<AdvertisingCreativeFormatType, FormatSpec> = {
  SEARCH_TEXT_AD: {
    textLimits: { headline: 30, description: 90, displayPath: 15 },
  },
  RESPONSIVE_SEARCH_AD: {
    textLimits: { headline: 30, longHeadline: 90, description: 90, displayPath: 15 },
  },
  DISPLAY_BANNER: {
    aspectRatio: "1.91:1",
    resolution: "1200x628",
    maxFileSizeBytes: 5_120_000,
    textLimits: { headline: 30, description: 90 },
  },
  SINGLE_IMAGE: {
    aspectRatio: "1:1",
    resolution: "1080x1080",
    maxFileSizeBytes: 30_000_000,
    textLimits: { primaryText: 125, headline: 40, description: 30 },
  },
  CAROUSEL: {
    aspectRatio: "1:1",
    resolution: "1080x1080",
    maxFileSizeBytes: 30_000_000,
    textLimits: { primaryText: 125, headline: 40 },
  },
  STORY: {
    aspectRatio: "9:16",
    resolution: "1080x1920",
    maxDurationSeconds: 15,
    maxFileSizeBytes: 30_000_000,
    textLimits: { primaryText: 125 },
    safeZones: { top: 250, bottom: 250 },
  },
  REEL: {
    aspectRatio: "9:16",
    resolution: "1080x1920",
    maxDurationSeconds: 90,
    maxFileSizeBytes: 100_000_000,
    audioRequired: true,
    subtitlesRequired: true,
    textLimits: { caption: 2200, videoHook: 100 },
  },
  SHORT_VIDEO: {
    aspectRatio: "9:16",
    resolution: "1080x1920",
    maxDurationSeconds: 60,
    maxFileSizeBytes: 100_000_000,
    audioRequired: true,
    subtitlesRequired: true,
    textLimits: { caption: 2200, videoHook: 100 },
  },
  LONG_VIDEO: {
    aspectRatio: "16:9",
    resolution: "1920x1080",
    maxDurationSeconds: 600,
    maxFileSizeBytes: 500_000_000,
    audioRequired: true,
    subtitlesRequired: true,
    thumbnailRequired: true,
    textLimits: { headline: 100, description: 5000 },
  },
  LEAD_FORM_AD: {
    textLimits: { headline: 40, primaryText: 125, description: 30 },
  },
  DOCUMENT_AD: {
    aspectRatio: "1.91:1",
    maxFileSizeBytes: 10_000_000,
    textLimits: { headline: 70, description: 100 },
  },
  MESSAGE_AD: {
    textLimits: { primaryText: 300, headline: 40 },
  },
  COLLECTION: {
    aspectRatio: "1:1",
    resolution: "1080x1080",
    maxFileSizeBytes: 30_000_000,
    textLimits: { headline: 40, primaryText: 125 },
  },
  PERFORMANCE_MAX_ASSET: {
    textLimits: { headline: 30, longHeadline: 90, description: 90 },
  },
  PROVIDER_EXTENSION: {
    textLimits: { callout: 25, sitelink: 25 },
  },
};

export const CHANNEL_FORMAT_COMPATIBILITY: Partial<
  Record<AdvertisingChannelType, AdvertisingCreativeFormatType[]>
> = {
  GOOGLE_SEARCH: ["SEARCH_TEXT_AD", "RESPONSIVE_SEARCH_AD"],
  GOOGLE_DISPLAY: ["DISPLAY_BANNER", "SINGLE_IMAGE"],
  GOOGLE_VIDEO: ["SHORT_VIDEO", "LONG_VIDEO"],
  GOOGLE_PERFORMANCE_MAX: ["PERFORMANCE_MAX_ASSET", "SINGLE_IMAGE", "SHORT_VIDEO"],
  META_FACEBOOK: ["SINGLE_IMAGE", "CAROUSEL", "SHORT_VIDEO", "COLLECTION", "LEAD_FORM_AD"],
  META_INSTAGRAM: ["SINGLE_IMAGE", "CAROUSEL", "STORY", "REEL"],
  LINKEDIN: ["SINGLE_IMAGE", "CAROUSEL", "DOCUMENT_AD", "SHORT_VIDEO"],
  TIKTOK: ["REEL", "SHORT_VIDEO"],
  YOUTUBE: ["LONG_VIDEO", "SHORT_VIDEO"],
  X: ["SINGLE_IMAGE", "SHORT_VIDEO"],
};

export function getFormatSpec(formatType: AdvertisingCreativeFormatType): FormatSpec {
  return FORMAT_SPECS[formatType];
}
