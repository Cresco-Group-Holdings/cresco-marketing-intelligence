import type { ContentType } from "@prisma/client";
import type { ChannelVariantDraft } from "@/lib/organic-growth/types";

export type ChannelFormatConstraint = {
  provider: string;
  format: string;
  maxCharacters: number | null;
  requiresMedia: boolean;
  mediaType?: "image" | "video" | "carousel";
  label: string;
};

export const CHANNEL_FORMAT_CONSTRAINTS: ChannelFormatConstraint[] = [
  { provider: "LINKEDIN", format: "TEXT_POST", maxCharacters: 3000, requiresMedia: false, label: "LinkedIn post" },
  { provider: "LINKEDIN", format: "CAROUSEL", maxCharacters: 3000, requiresMedia: true, mediaType: "carousel", label: "LinkedIn carousel" },
  { provider: "X", format: "TEXT_POST", maxCharacters: 280, requiresMedia: false, label: "X post" },
  { provider: "X", format: "THREAD", maxCharacters: 280, requiresMedia: false, label: "X thread" },
  { provider: "INSTAGRAM", format: "IMAGE_POST", maxCharacters: 2200, requiresMedia: true, mediaType: "image", label: "Instagram post" },
  { provider: "INSTAGRAM", format: "CAROUSEL", maxCharacters: 2200, requiresMedia: true, mediaType: "carousel", label: "Instagram carousel" },
  { provider: "INSTAGRAM", format: "SHORT_VIDEO", maxCharacters: 2200, requiresMedia: true, mediaType: "video", label: "Instagram Reel" },
  { provider: "TIKTOK", format: "SHORT_VIDEO", maxCharacters: 2200, requiresMedia: true, mediaType: "video", label: "TikTok video" },
  { provider: "YOUTUBE", format: "SHORT_VIDEO", maxCharacters: 100, requiresMedia: true, mediaType: "video", label: "YouTube Short" },
  { provider: "YOUTUBE", format: "LONG_VIDEO", maxCharacters: 5000, requiresMedia: true, mediaType: "video", label: "YouTube video" },
  { provider: "FACEBOOK", format: "TEXT_POST", maxCharacters: 63206, requiresMedia: false, label: "Facebook post" },
  { provider: "THREADS", format: "TEXT_POST", maxCharacters: 500, requiresMedia: false, label: "Threads post" },
  { provider: "PINTEREST", format: "IMAGE_POST", maxCharacters: 500, requiresMedia: true, mediaType: "image", label: "Pinterest pin" },
];

export type ValidationIssue = {
  code: string;
  message: string;
  action?: { label: string; href?: string };
};

export function validateChannelVariant(input: {
  provider: string;
  format: string;
  copy: string;
  hasMedia: boolean;
  accountConnected: boolean;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const constraint = CHANNEL_FORMAT_CONSTRAINTS.find(
    (c) => c.provider === input.provider && c.format === input.format,
  );

  if (!input.accountConnected) {
    issues.push({
      code: "missing_connection",
      message: `Connect a ${input.provider} account before publishing to this channel.`,
      action: { label: "Connect account", href: "/organic-social/accounts" },
    });
  }

  if (!constraint) {
    issues.push({
      code: "unsupported_format",
      message: `${input.format} is not supported for ${input.provider}.`,
    });
    return issues;
  }

  if (constraint.requiresMedia && !input.hasMedia) {
    const mediaLabel =
      constraint.mediaType === "carousel"
        ? "at least one image asset"
        : constraint.mediaType === "video"
          ? "a video asset"
          : "an image asset";
    issues.push({
      code: "missing_media",
      message: `${constraint.label} requires ${mediaLabel}.`,
      action: { label: "Add asset", href: "#assets" },
    });
  }

  if (constraint.maxCharacters != null && input.copy.length > constraint.maxCharacters) {
    issues.push({
      code: "length_exceeded",
      message: `${constraint.label} exceeds the ${constraint.maxCharacters.toLocaleString()} character limit (${input.copy.length} characters).`,
    });
  }

  return issues;
}

export function buildVariantDraftsFromSource(input: {
  sourceContentId: string;
  title: string;
  body: string;
  targetProviders: string[];
}): ChannelVariantDraft[] {
  return input.targetProviders.flatMap((provider) => {
    const formats = CHANNEL_FORMAT_CONSTRAINTS.filter((c) => c.provider === provider);
    return formats.slice(0, 1).map((constraint) => {
      const copy = input.body.slice(0, constraint.maxCharacters ?? input.body.length);
      const validationIssues = validateChannelVariant({
        provider,
        format: constraint.format,
        copy,
        hasMedia: constraint.requiresMedia ? false : true,
        accountConnected: false,
      });
      return {
        provider,
        format: constraint.format,
        copy,
        title: input.title,
        hook: input.title,
        cta: undefined,
        hashtags: [],
        mediaRequirements: constraint.requiresMedia
          ? [constraint.mediaType === "video" ? "Video required" : "Image required"]
          : [],
        lengthValidation: {
          current: copy.length,
          max: constraint.maxCharacters,
          valid: constraint.maxCharacters == null || copy.length <= constraint.maxCharacters,
        },
        status: "draft" as const,
        lineage: {
          sourceContentId: input.sourceContentId,
          provider,
          format: constraint.format,
        },
      };
    });
  });
}

export function mapContentTypeToFormatLabel(format: ContentType): string {
  return format
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
