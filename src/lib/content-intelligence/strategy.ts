import type { ContentStrategy } from "@/lib/content-intelligence/types";
import type { ResolvedBrandContext } from "@/lib/content-intelligence/brand-context";
import { DEFAULT_CONTENT_THEMES } from "@/lib/content-intelligence/themes";

export function buildDefaultContentStrategy(
  brand: ResolvedBrandContext,
  activeCampaign?: {
    id: string;
    name: string;
    objective?: string | null;
    channels?: string[];
  } | null,
): ContentStrategy {
  const audienceLabels = [
    ...brand.audiences.map((a) => a.name),
    ...brand.personas.map((p) => p.name),
  ].slice(0, 5);

  const offerLabels = brand.offers.map((o) => o.name).slice(0, 5);

  return {
    primaryObjective: null,
    funnelStage: null,
    targetAudienceIds: brand.audiences.map((a) => a.id).slice(0, 5),
    targetAudienceLabels: audienceLabels,
    offerIds: brand.offers.map((o) => o.id).slice(0, 5),
    offerLabels,
    contentPillars: DEFAULT_CONTENT_THEMES.filter((t) =>
      ["product_education", "founder_insights", "customer_proof", "industry_trends"].includes(t.key),
    ).map((t) => t.key),
    primaryChannels: activeCampaign?.channels?.length
      ? activeCampaign.channels
      : ["LINKEDIN", "X"],
    secondaryChannels: ["INSTAGRAM", "YOUTUBE"],
    publishingCadence: "3–5 posts per week across primary channels",
    keyMessages: [
      brand.coreMessage,
      brand.valueProposition,
      brand.tagline,
    ].filter((msg): msg is string => Boolean(msg?.trim())),
    ctaStrategy: brand.offers[0]?.name
      ? `Drive action toward ${brand.offers[0].name}`
      : null,
    constraints: brand.prohibitedClaims.slice(0, 5),
    complianceNotes: [
      ...brand.mandatoryDisclosures.slice(0, 3),
      brand.prohibitedTone ? `Avoid tone: ${brand.prohibitedTone}` : null,
    ].filter((note): note is string => Boolean(note)),
    successMetrics: ["Reach", "Engagement rate", "Profile visits", "Clicks"],
    narrative: activeCampaign
      ? `Support campaign "${activeCampaign.name}" with aligned content across primary channels.`
      : "Build consistent authority and demand through structured themes and channel-native content.",
  };
}
