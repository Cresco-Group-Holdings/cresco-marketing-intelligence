import type {
  BrandAlignmentDimension,
  BrandAlignmentResult,
  BrandAlignmentState,
  MasterContent,
} from "@/lib/content-intelligence/types";
import type { ResolvedBrandContext } from "@/lib/content-intelligence/brand-context";

function scoreDimension(
  present: boolean,
  aligned: boolean,
): BrandAlignmentState {
  if (!present) return "not_evaluated";
  if (aligned) return "strong";
  return "moderate";
}

export function evaluateBrandAlignment(
  content: Pick<MasterContent, "body" | "hook" | "cta" | "keyPoints">,
  brand: ResolvedBrandContext,
): BrandAlignmentResult {
  const text = [content.hook, content.body, content.cta, ...content.keyPoints]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const dimensions: BrandAlignmentResult["dimensions"] = [];

  const hasMessaging = Boolean(brand.coreMessage?.trim() || brand.valueProposition?.trim());
  const messagingAligned =
    hasMessaging &&
    (text.includes((brand.coreMessage ?? "").toLowerCase().slice(0, 20)) ||
      text.includes((brand.valueProposition ?? "").toLowerCase().slice(0, 20)) ||
      content.keyPoints.length >= 2);
  dimensions.push({
    key: "messaging",
    label: "Messaging alignment",
    state: hasMessaging ? scoreDimension(true, messagingAligned) : "missing",
    explanation: hasMessaging
      ? messagingAligned
        ? "Content reflects core brand messaging."
        : "Key message could be strengthened to reflect brand positioning."
      : "Core messaging not defined in Brand Knowledge.",
  });

  const hasTone = Boolean(brand.preferredTone?.trim());
  dimensions.push({
    key: "tone",
    label: "Voice & tone",
    state: hasTone ? "moderate" : "missing",
    explanation: hasTone
      ? `Review against preferred tone: ${brand.preferredTone}`
      : "Preferred tone not defined in Brand Knowledge.",
  });

  const hasOffer = brand.offers.length > 0;
  const offerMentioned = brand.offers.some((offer) =>
    text.includes(offer.name.toLowerCase().slice(0, 12)),
  );
  dimensions.push({
    key: "offer",
    label: "Offer alignment",
    state: hasOffer ? (offerMentioned ? "strong" : "moderate") : "not_evaluated",
    explanation: hasOffer
      ? offerMentioned
        ? "Content references an active offer."
        : "Consider connecting content to a relevant offer."
      : "No offers defined — offer alignment not evaluated.",
  });

  const hasAudience = brand.audiences.length > 0 || Boolean(brand.targetAudience?.trim());
  dimensions.push({
    key: "audience",
    label: "Audience relevance",
    state: hasAudience ? "moderate" : "missing",
    explanation: hasAudience
      ? "Audience context available — review for specificity."
      : "Target audience not defined in Brand Knowledge.",
  });

  const prohibitedHit = brand.prohibitedVocabulary.find((word) =>
    text.includes(word.toLowerCase()),
  );
  dimensions.push({
    key: "vocabulary",
    label: "Vocabulary compliance",
    state: brand.prohibitedVocabulary.length
      ? prohibitedHit
        ? "weak"
        : "strong"
      : "not_evaluated",
    explanation: prohibitedHit
      ? `Contains prohibited term: "${prohibitedHit}"`
      : brand.prohibitedVocabulary.length
        ? "No prohibited vocabulary detected."
        : "Prohibited vocabulary rules not configured.",
  });

  const claimHit = brand.prohibitedClaims.find((claim) =>
    text.includes(claim.toLowerCase().slice(0, 20)),
  );
  dimensions.push({
    key: "compliance",
    label: "Compliance",
    state: brand.prohibitedClaims.length
      ? claimHit
        ? "weak"
        : "moderate"
      : "not_evaluated",
    explanation: claimHit
      ? "Potential prohibited claim detected — review before approval."
      : "No obvious prohibited claims detected. This is not legal approval.",
  });

  dimensions.push({
    key: "cta",
    label: "CTA alignment",
    state: content.cta?.trim() ? "strong" : "weak",
    explanation: content.cta?.trim()
      ? "Call-to-action is present."
      : "Add a clear call-to-action aligned with the objective.",
  });

  const scored = dimensions.filter((d) => d.state !== "not_evaluated" && d.state !== "missing");
  const points = scored.reduce((sum, d) => {
    const map: Record<BrandAlignmentState, number> = {
      strong: 100,
      moderate: 70,
      weak: 40,
      missing: 0,
      not_evaluated: 0,
    };
    return sum + map[d.state];
  }, 0);

  const score = scored.length > 0 ? Math.round(points / scored.length) : null;

  return {
    score,
    scoreLabel: score !== null ? `${score}/100` : "Not enough data",
    dimensions,
    disclaimer: "Based on observed Brand Knowledge. Performance signal, not causal evidence.",
  };
}
