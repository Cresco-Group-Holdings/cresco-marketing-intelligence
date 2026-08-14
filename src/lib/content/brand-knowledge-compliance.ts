import type { BrandMarketingChannel, ContentComplianceCheckType } from "@prisma/client";

export type BrandKnowledgeComplianceInput = {
  title: string;
  studioObjective?: string | null;
  audienceSummary?: string | null;
  contentBody?: string | null;
  primaryMessage?: string | null;
  primaryCTA?: string | null;
  contentCampaignId?: string | null;
  primaryChannel?: BrandMarketingChannel | null;
  variants: Array<{
    id: string;
    marketingChannel?: BrandMarketingChannel | null;
    channelBody?: string | null;
    caption?: string | null;
  }>;
  assets: Array<{ id: string; approvedForMarketing: boolean }>;
  knowledgeReferences: Array<{ referenceType: string; label: string }>;
  brandContext: {
    hasProfile: boolean;
    hasMessaging: boolean;
    hasVoice: boolean;
    hasAudiences: boolean;
    prohibitedClaims: string[];
    prohibitedVocabulary: string[];
    proofPoints: string[];
    preferredTone?: string | null;
    ctaLibrary: string[];
  };
};

export type BrandKnowledgeComplianceFinding = {
  checkType: ContentComplianceCheckType;
  result: "PASS" | "FAIL" | "WARNING";
  message: string;
  blocking: boolean;
  contentVariantId?: string;
};

function collectText(input: BrandKnowledgeComplianceInput): string {
  const parts = [
    input.title,
    input.studioObjective,
    input.audienceSummary,
    input.contentBody,
    input.primaryMessage,
    input.primaryCTA,
    ...input.variants.flatMap((v) => [v.channelBody, v.caption]),
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function runBrandKnowledgeComplianceChecks(
  input: BrandKnowledgeComplianceInput,
): BrandKnowledgeComplianceFinding[] {
  const findings: BrandKnowledgeComplianceFinding[] = [];
  const text = collectText(input);

  if (!input.brandContext.hasProfile || !input.brandContext.hasMessaging) {
    findings.push({
      checkType: "MISSING_BRAND_CONTEXT",
      result: "WARNING",
      message:
        "Brand profile or messaging is incomplete. Content may lack required brand context.",
      blocking: false,
    });
  }

  if (!input.primaryCTA?.trim() && input.brandContext.ctaLibrary.length === 0) {
    findings.push({
      checkType: "MISSING_CTA",
      result: "WARNING",
      message: "No call-to-action is defined and the brand CTA library is empty.",
      blocking: false,
    });
  } else if (!input.primaryCTA?.trim()) {
    findings.push({
      checkType: "MISSING_CTA",
      result: "WARNING",
      message: "Content is missing a call-to-action.",
      blocking: false,
    });
  }

  for (const claim of input.brandContext.prohibitedClaims) {
    if (claim && text.includes(claim.toLowerCase())) {
      findings.push({
        checkType: "PROHIBITED_CLAIM",
        result: "WARNING",
        message: `Content may contain prohibited claim: "${claim}". Review before approval.`,
        blocking: false,
      });
    }
  }

  for (const word of input.brandContext.prohibitedVocabulary) {
    if (word && text.includes(word.toLowerCase())) {
      findings.push({
        checkType: "TONE_OF_VOICE_WARNING",
        result: "WARNING",
        message: `Content uses prohibited vocabulary: "${word}".`,
        blocking: false,
      });
    }
  }

  if (input.brandContext.proofPoints.length > 0) {
    const hasProofReference = input.brandContext.proofPoints.some(
      (point) => point && text.includes(point.toLowerCase().slice(0, 20)),
    );
    const hasUnsupported =
      /\b(guarantee|best in class|#1|always|never fails)\b/i.test(text) && !hasProofReference;
    if (hasUnsupported) {
      findings.push({
        checkType: "UNSUPPORTED_STATEMENT",
        result: "WARNING",
        message:
          "Content contains strong claims that are not supported by brand proof points.",
        blocking: false,
      });
    }
  }

  if (input.brandContext.preferredTone) {
    const informalMarkers = /\b(hey|lol|omg|gonna|wanna)\b/i;
    const formalTone = /professional|formal|authoritative/i.test(
      input.brandContext.preferredTone,
    );
    if (formalTone && informalMarkers.test(text)) {
      findings.push({
        checkType: "TONE_OF_VOICE_WARNING",
        result: "WARNING",
        message: `Informal language detected; brand preferred tone is "${input.brandContext.preferredTone}".`,
        blocking: false,
      });
    }
  }

  if (!input.contentCampaignId) {
    findings.push({
      checkType: "MISSING_CAMPAIGN",
      result: "WARNING",
      message: "Content is not linked to a campaign.",
      blocking: false,
    });
  }

  if (input.primaryChannel) {
    const hasChannelVariant = input.variants.some(
      (v) => v.marketingChannel === input.primaryChannel,
    );
    if (!hasChannelVariant) {
      findings.push({
        checkType: "MISSING_CHANNEL_VARIANT",
        result: "WARNING",
        message: `No variant exists for primary channel ${input.primaryChannel}.`,
        blocking: false,
      });
    }
  }

  for (const asset of input.assets) {
    if (!asset.approvedForMarketing) {
      findings.push({
        checkType: "UNAPPROVED_ASSET",
        result: "WARNING",
        message: "An attached asset is not approved for marketing use.",
        blocking: false,
      });
    }
  }

  return findings;
}

export function hasBlockingBrandComplianceFailures(
  findings: BrandKnowledgeComplianceFinding[],
): boolean {
  return findings.some((f) => f.blocking && f.result === "FAIL");
}
