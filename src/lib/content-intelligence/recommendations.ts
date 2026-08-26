import type {
  ContentOpportunity,
  EvidenceStrength,
  NextContentRecommendation,
} from "@/lib/content-intelligence/types";

export function buildNextContentRecommendation(input: {
  opportunities: ContentOpportunity[];
  topTheme?: { label: string; liftLabel?: string } | null;
  scheduleGapChannel?: string | null;
  campaignName?: string | null;
  audienceLabel?: string | null;
}): NextContentRecommendation | null {
  const primary = input.opportunities[0];
  if (!primary && !input.topTheme && !input.scheduleGapChannel) {
    return null;
  }

  const why: string[] = [];
  const evidence: Array<{ label: string; value: string }> = [];

  if (input.topTheme?.liftLabel) {
    why.push(`${input.topTheme.label} content performs ${input.topTheme.liftLabel} above your median`);
    evidence.push({ label: "Theme performance", value: input.topTheme.liftLabel });
  }

  if (input.scheduleGapChannel) {
    why.push(`No ${input.scheduleGapChannel} post is scheduled for the next few days`);
    evidence.push({ label: "Channel gap", value: input.scheduleGapChannel });
  }

  if (input.campaignName) {
    why.push(`Current campaign "${input.campaignName}" needs supporting content`);
    evidence.push({ label: "Campaign", value: input.campaignName });
  }

  if (input.audienceLabel) {
    why.push(`Targets ${input.audienceLabel}`);
    evidence.push({ label: "Audience", value: input.audienceLabel });
  }

  if (primary) {
    why.push(primary.whyItMatters);
    evidence.push(...primary.evidence);
  }

  const topic =
    primary?.recommendedContent ??
    (input.topTheme
      ? `Educational ${input.topTheme.label} post`
      : `New ${input.scheduleGapChannel ?? "LinkedIn"} content`);

  const channels = primary?.recommendedChannels ?? [input.scheduleGapChannel ?? "LINKEDIN"];

  const evidenceStrength: EvidenceStrength =
    primary?.evidenceStrength ?? (input.topTheme ? "moderate" : "emerging");

  return {
    id: "next-content-primary",
    title: "Recommended next content",
    topic,
    format: topic.toLowerCase().includes("carousel") ? "Carousel" : "Post",
    channels,
    why: why.slice(0, 4),
    evidence: evidence.slice(0, 4),
    evidenceStrength,
    action: primary?.action ?? {
      label: "Create brief",
      href: "/content/studio/create",
    },
  };
}
