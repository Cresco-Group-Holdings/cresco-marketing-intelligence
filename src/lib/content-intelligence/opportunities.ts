import type { ContentOpportunity, EvidenceStrength } from "@/lib/content-intelligence/types";

function evidenceStrengthFromSignals(signals: number): EvidenceStrength {
  if (signals >= 3) return "strong";
  if (signals >= 2) return "moderate";
  return "emerging";
}

type OpportunityInput = {
  winningContent?: Array<{
    id: string;
    title: string;
    channel: string;
    liftLabel: string;
    evidenceStrength?: EvidenceStrength;
  }>;
  scheduleGaps?: Array<{ channel: string; message: string }>;
  campaignGaps?: Array<{ campaignName: string; missingCount: number }>;
  themeGaps?: Array<{ theme: string; label: string; reason: string }>;
  competitorGaps?: Array<{ topic: string; evidence: string; competitorCount: number }>;
};

export function buildContentOpportunities(input: OpportunityInput): ContentOpportunity[] {
  const opportunities: ContentOpportunity[] = [];

  for (const winner of input.winningContent ?? []) {
    opportunities.push({
      id: `opp-winner-${winner.id}`,
      source: "winning_content",
      title: "Repurpose winning content",
      finding: `${winner.title} is outperforming on ${winner.channel}`,
      evidence: [
        { label: "Lift", value: winner.liftLabel },
        { label: "Channel", value: winner.channel },
      ],
      whyItMatters: "High-performing content can be adapted for additional channels or follow-up angles.",
      recommendedContent: `Follow-up or repurposed version of "${winner.title}"`,
      recommendedChannels: [winner.channel, "LINKEDIN", "X"].filter(
        (c, i, arr) => arr.indexOf(c) === i,
      ),
      evidenceStrength: winner.evidenceStrength ?? "moderate",
      action: {
        label: "Create brief",
        href: `/content/studio/create?source=winning&contentId=${winner.id}`,
      },
    });
  }

  for (const [index, gap] of (input.scheduleGaps ?? []).entries()) {
    opportunities.push({
      id: `opp-schedule-${index}`,
      source: "calendar_gap",
      title: "Publishing gap detected",
      finding: gap.message,
      evidence: [{ label: "Channel", value: gap.channel }],
      whyItMatters: "Consistent publishing supports reach momentum and audience retention.",
      recommendedContent: `New ${gap.channel} post aligned with active content pillars`,
      recommendedChannels: [gap.channel],
      evidenceStrength: "moderate",
      action: {
        label: "Create brief",
        href: `/content/studio/create?channel=${encodeURIComponent(gap.channel)}`,
      },
    });
  }

  for (const gap of input.campaignGaps ?? []) {
    opportunities.push({
      id: `opp-campaign-${gap.campaignName}`,
      source: "campaign",
      title: "Campaign content missing",
      finding: `${gap.missingCount} content item(s) needed for ${gap.campaignName}`,
      evidence: [{ label: "Campaign", value: gap.campaignName }],
      whyItMatters: "Campaigns need supporting content to achieve their objectives.",
      recommendedContent: `Campaign-aligned content for ${gap.campaignName}`,
      recommendedChannels: ["LINKEDIN"],
      evidenceStrength: "moderate",
      action: {
        label: "Create brief",
        href: `/content/studio/create?campaign=${encodeURIComponent(gap.campaignName)}`,
      },
    });
  }

  for (const gap of input.themeGaps ?? []) {
    opportunities.push({
      id: `opp-theme-${gap.theme}`,
      source: "theme_gap",
      title: "Underused content pillar",
      finding: gap.reason,
      evidence: [{ label: "Theme", value: gap.label }],
      whyItMatters: "Balanced pillar coverage reduces audience fatigue and improves strategic coverage.",
      recommendedContent: `New ${gap.label} content`,
      recommendedChannels: ["LINKEDIN"],
      evidenceStrength: "emerging",
      action: {
        label: "Create brief",
        href: `/content/studio/create?pillar=${encodeURIComponent(gap.theme)}`,
      },
    });
  }

  for (const gap of input.competitorGaps ?? []) {
    opportunities.push({
      id: `opp-competitor-${gap.topic}`,
      source: "competitor_gap",
      title: "Competitor content gap",
      finding: gap.evidence,
      evidence: [
        { label: "Topic", value: gap.topic },
        { label: "Competitors covering", value: String(gap.competitorCount) },
      ],
      whyItMatters: "Addressing underserved angles can differentiate your brand in the market.",
      recommendedContent: `Authoritative content on "${gap.topic}"`,
      recommendedChannels: ["LINKEDIN"],
      evidenceStrength: evidenceStrengthFromSignals(gap.competitorCount >= 2 ? 2 : 1),
      action: {
        label: "Create brief",
        href: `/content/studio/create?topic=${encodeURIComponent(gap.topic)}`,
      },
    });
  }

  return opportunities.sort((a, b) => {
    const order = { strong: 3, moderate: 2, emerging: 1 };
    return order[b.evidenceStrength] - order[a.evidenceStrength];
  });
}
