import { FORMAT_SPECS } from "@/lib/advertising-creatives/format-specs";
import type { AdvertisingCreativeFormatType } from "@prisma/client";

export type CreativeValidationInput = {
  format: string;
  primaryText?: string;
  headline?: string;
  description?: string;
  aspectRatio?: string;
  fileSizeBytes?: number;
  durationSeconds?: number;
  destinationUrl?: string;
  facebookPageId?: string;
  instagramAccountId?: string;
  placement?: string;
};

export type CreativeValidationIssue = {
  code: string;
  severity: "ERROR" | "WARNING";
  message: string;
};

export function validateMetaCreative(input: CreativeValidationInput): {
  valid: boolean;
  issues: CreativeValidationIssue[];
} {
  const issues: CreativeValidationIssue[] = [];
  const formatKey = mapFormatToSpec(input.format);
  const spec = formatKey ? FORMAT_SPECS[formatKey] : null;

  if (!spec) {
    issues.push({ code: "UNSUPPORTED_FORMAT", severity: "ERROR", message: `Format ${input.format} is not supported.` });
  } else {
    const limits = spec.textLimits ?? {};
    if (input.primaryText && limits.primaryText && input.primaryText.length > limits.primaryText) {
      issues.push({ code: "PRIMARY_TEXT_TOO_LONG", severity: "ERROR", message: "Primary text exceeds limit." });
    }
    if (input.headline && limits.headline && input.headline.length > limits.headline) {
      issues.push({ code: "HEADLINE_TOO_LONG", severity: "ERROR", message: "Headline exceeds limit." });
    }
    if (spec.maxFileSizeBytes && input.fileSizeBytes && input.fileSizeBytes > spec.maxFileSizeBytes) {
      issues.push({ code: "FILE_TOO_LARGE", severity: "ERROR", message: "Creative file exceeds size limit." });
    }
    if (spec.maxDurationSeconds && input.durationSeconds && input.durationSeconds > spec.maxDurationSeconds) {
      issues.push({ code: "VIDEO_TOO_LONG", severity: "ERROR", message: "Video exceeds duration limit." });
    }
    if (spec.aspectRatio && input.aspectRatio && input.aspectRatio !== spec.aspectRatio) {
      issues.push({ code: "ASPECT_RATIO_MISMATCH", severity: "WARNING", message: `Expected ${spec.aspectRatio}.` });
    }
  }

  if (!input.destinationUrl?.startsWith("http")) {
    issues.push({ code: "INVALID_DESTINATION", severity: "ERROR", message: "Valid destination URL required." });
  }
  if (!input.facebookPageId) {
    issues.push({ code: "MISSING_PAGE", severity: "ERROR", message: "Facebook Page is required." });
  }
  if (input.placement?.includes("instagram") && !input.instagramAccountId) {
    issues.push({ code: "INSTAGRAM_MISMATCH", severity: "ERROR", message: "Instagram placement requires linked Instagram account." });
  }

  return { valid: !issues.some((i) => i.severity === "ERROR"), issues };
}

function mapFormatToSpec(format: string): AdvertisingCreativeFormatType | null {
  const map: Record<string, AdvertisingCreativeFormatType> = {
    SINGLE_IMAGE: "SINGLE_IMAGE",
    CAROUSEL: "CAROUSEL",
    SHORT_VIDEO: "SHORT_VIDEO",
    REEL: "REEL",
    STORY: "STORY",
    FEED: "SINGLE_IMAGE",
    LEAD_FORM: "LEAD_FORM_AD",
  };
  return map[format] ?? null;
}
