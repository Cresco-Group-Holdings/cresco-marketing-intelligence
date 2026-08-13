import type {
  ContentComplianceCheckType,
  ContentComplianceResult,
  ContentType,
  SocialProvider,
} from "@prisma/client";

export type ComplianceInput = {
  contentType: ContentType;
  primaryMessage?: string | null;
  destinationUrl?: string | null;
  disclaimer?: string | null;
  prohibitedClaims?: string[];
  variants: Array<{
    id: string;
    provider: SocialProvider | null;
    format: ContentType;
    caption?: string | null;
    altText?: string | null;
    destinationUrl?: string | null;
  }>;
  assets: Array<{
    id: string;
    approvedForMarketing: boolean;
    licenceExpiresAt: Date | null;
    attributionRequired: boolean;
  }>;
  provenance?: {
    musicLicence?: string | null;
    voiceConsent: boolean;
    faceConsent: boolean;
    commercialUsePermission: boolean;
  } | null;
};

export type ComplianceFinding = {
  checkType: ContentComplianceCheckType;
  result: ContentComplianceResult;
  message: string;
  blocking: boolean;
  contentVariantId?: string;
};

const PROVIDER_FORMAT_SUPPORT: Partial<Record<SocialProvider, ContentType[]>> = {
  INSTAGRAM: ["IMAGE_POST", "CAROUSEL", "SHORT_VIDEO", "STORY"],
  FACEBOOK: ["TEXT_POST", "IMAGE_POST", "CAROUSEL", "SHORT_VIDEO", "LONG_VIDEO", "ARTICLE_LINK", "POLL"],
  LINKEDIN: ["TEXT_POST", "IMAGE_POST", "CAROUSEL", "LONG_VIDEO", "ARTICLE_LINK", "POLL"],
  TIKTOK: ["SHORT_VIDEO"],
  YOUTUBE: ["LONG_VIDEO", "SHORT_VIDEO"],
  X: ["TEXT_POST", "IMAGE_POST", "THREAD", "POLL"],
};

const TEXT_LIMITS: Partial<Record<SocialProvider, number>> = {
  X: 280,
  INSTAGRAM: 2200,
  LINKEDIN: 3000,
};

export function runComplianceChecks(input: ComplianceInput): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];

  if (!input.disclaimer?.trim()) {
    findings.push({
      checkType: "MISSING_DISCLAIMER",
      result: "WARNING",
      message: "No disclaimer text is attached to this content.",
      blocking: false,
    });
  }

  for (const claim of input.prohibitedClaims ?? []) {
    const haystack = `${input.primaryMessage ?? ""}`.toLowerCase();
    if (claim && haystack.includes(claim.toLowerCase())) {
      findings.push({
        checkType: "PROHIBITED_CLAIM",
        result: "FAIL",
        message: `Content may contain prohibited claim: ${claim}`,
        blocking: true,
      });
    }
  }

  if (
    ["ARTICLE_LINK", "IMAGE_POST", "CAROUSEL"].includes(input.contentType) &&
    !input.destinationUrl?.trim()
  ) {
    findings.push({
      checkType: "MISSING_DESTINATION_URL",
      result: "FAIL",
      message: "Destination URL is required for this content type.",
      blocking: true,
    });
  }

  for (const variant of input.variants) {
    if (!variant.provider) {
      continue;
    }

    const supported = PROVIDER_FORMAT_SUPPORT[variant.provider] ?? [];
    if (!supported.includes(variant.format)) {
      findings.push({
        checkType: "UNSUPPORTED_PLATFORM_FORMAT",
        result: "FAIL",
        message: `${variant.provider} does not support ${variant.format}.`,
        blocking: true,
        contentVariantId: variant.id,
      });
    }

    if (["IMAGE_POST", "CAROUSEL"].includes(variant.format) && !variant.altText?.trim()) {
      findings.push({
        checkType: "MISSING_ALT_TEXT",
        result: "FAIL",
        message: "Alt text is required for image-based variants.",
        blocking: true,
        contentVariantId: variant.id,
      });
    }

    const limit = TEXT_LIMITS[variant.provider];
    if (limit && (variant.caption?.length ?? 0) > limit) {
      findings.push({
        checkType: "EXCESSIVE_TEXT_LENGTH",
        result: "FAIL",
        message: `Caption exceeds ${limit} characters for ${variant.provider}.`,
        blocking: true,
        contentVariantId: variant.id,
      });
    }

    if (
      ["ARTICLE_LINK", "IMAGE_POST"].includes(variant.format) &&
      !variant.destinationUrl?.trim() &&
      !input.destinationUrl?.trim()
    ) {
      findings.push({
        checkType: "MISSING_DESTINATION_URL",
        result: "FAIL",
        message: "Variant destination URL is required.",
        blocking: true,
        contentVariantId: variant.id,
      });
    }
  }

  for (const asset of input.assets) {
    if (!asset.approvedForMarketing) {
      findings.push({
        checkType: "UNAPPROVED_ASSET",
        result: "FAIL",
        message: "An attached asset is not approved for marketing use.",
        blocking: true,
      });
    }
    if (asset.licenceExpiresAt && asset.licenceExpiresAt < new Date()) {
      findings.push({
        checkType: "EXPIRED_ASSET_LICENCE",
        result: "FAIL",
        message: "An attached asset licence has expired.",
        blocking: true,
      });
    }
  }

  if (input.provenance) {
    if (!input.provenance.musicLicence?.trim()) {
      findings.push({
        checkType: "UNAPPROVED_MUSIC",
        result: "WARNING",
        message: "Music licence information is missing.",
        blocking: false,
      });
    }
    if (!input.provenance.voiceConsent || !input.provenance.faceConsent) {
      findings.push({
        checkType: "MISSING_CONSENT",
        result: "FAIL",
        message: "Voice and face consent must be recorded.",
        blocking: true,
      });
    }
  }

  return findings;
}

export function hasBlockingComplianceFailures(findings: ComplianceFinding[]): boolean {
  return findings.some((finding) => finding.blocking && finding.result === "FAIL");
}
