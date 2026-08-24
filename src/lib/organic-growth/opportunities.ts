import type { OrganicOpportunity, OrganicOpportunityType } from "@/lib/organic-growth/types";
import type { WinningContentItem } from "@/lib/organic-growth/types";
import type { ScheduleGap } from "@/lib/organic-social/types";
import type { PostingWindowInsight } from "@/lib/organic-social/types";

export function buildOrganicOpportunities(input: {
  winningContent: WinningContentItem[];
  scheduleGaps: ScheduleGap[];
  postingWindows: PostingWindowInsight[];
  underusedChannels: Array<{ channel: string; connected: boolean; publishedCount: number }>;
  topFormat: { format: string; uplift: number } | null;
  topTheme: { theme: string; engagementRate: number } | null;
}): OrganicOpportunity[] {
  const opportunities: OrganicOpportunity[] = [];

  for (const winner of input.winningContent.slice(0, 2)) {
    opportunities.push({
      id: `repurpose-${winner.id}`,
      type: "winning_repurpose",
      title: "Winning content ready to repurpose",
      finding: `"${winner.title}" on ${winner.channel} — ${winner.evidenceLabel}.`,
      evidence: [
        { label: "Engagement lift", value: `${winner.engagementLift?.toFixed(1) ?? "—"}× baseline` },
        { label: "Confidence", value: winner.confidence },
      ],
      confidence: winner.confidence,
      potentialImpact: "Extend proven creative across additional channels",
      action: { label: "Create variants", href: `/content/studio/${winner.id}?action=variants` },
    });
  }

  for (const gap of input.scheduleGaps) {
    opportunities.push({
      id: `consistency-${gap.channel}`,
      type: "consistency_gap",
      title: "Publishing consistency gap",
      finding: gap.message,
      evidence: [{ label: "Channel", value: gap.channel }],
      confidence: "medium",
      potentialImpact: "Maintain reach momentum with consistent publishing",
      action: { label: "Open calendar", href: "/calendar" },
    });
  }

  for (const window of input.postingWindows.slice(0, 2)) {
    if (window.sampleSize < 5) continue;
    opportunities.push({
      id: `best-time-${window.channel}-${window.dayOfWeek}`,
      type: "best_time",
      title: `High-performing window on ${window.channel}`,
      finding: `${window.dayOfWeek} ${window.hourRange} shows ${window.engagementLift.toFixed(1)}× baseline engagement.`,
      evidence: [
        { label: "Sample size", value: String(window.sampleSize) },
        { label: "Lift", value: `${window.engagementLift.toFixed(1)}×` },
      ],
      confidence: window.sampleSize >= 10 ? "medium" : "low",
      potentialImpact: "Schedule during observed high-engagement windows",
      action: { label: "Schedule content", href: "/organic-social/publishing" },
    });
  }

  for (const channel of input.underusedChannels.filter((c) => c.connected && c.publishedCount === 0)) {
    opportunities.push({
      id: `underused-${channel.channel}`,
      type: "underused_channel",
      title: `${channel.channel} is connected but unused`,
      finding: `No content published to ${channel.channel} in the selected period.`,
      evidence: [{ label: "Published", value: "0" }],
      confidence: "high",
      potentialImpact: "Activate an underused connected channel",
      action: { label: "Create content", href: "/content/studio/new" },
    });
  }

  if (input.topFormat && input.topFormat.uplift >= 1.3) {
    opportunities.push({
      id: `format-${input.topFormat.format}`,
      type: "format_opportunity",
      title: `${input.topFormat.format} outperforms other formats`,
      finding: `${input.topFormat.format} generated ${input.topFormat.uplift.toFixed(0)}% higher engagement than the format average.`,
      evidence: [{ label: "Uplift", value: `${input.topFormat.uplift.toFixed(0)}%` }],
      confidence: "medium",
      potentialImpact: `Increase ${input.topFormat.format} output`,
      action: { label: "Create content", href: "/content/studio/new" },
    });
  }

  if (input.topTheme) {
    opportunities.push({
      id: `theme-${input.topTheme.theme}`,
      type: "content_theme",
      title: `${input.topTheme.theme} drives engagement`,
      finding: `Content themed around "${input.topTheme.theme}" averaged ${input.topTheme.engagementRate.toFixed(2)}% engagement.`,
      evidence: [{ label: "Engagement rate", value: `${input.topTheme.engagementRate.toFixed(2)}%` }],
      confidence: "medium",
      potentialImpact: "Create more content in this high-performing theme",
      action: { label: "Create content", href: "/content/studio/new" },
    });
  }

  return opportunities;
}

export function pickTopOpportunity(opportunities: OrganicOpportunity[]): OrganicOpportunity | null {
  const priority: OrganicOpportunityType[] = [
    "consistency_gap",
    "winning_repurpose",
    "best_time",
    "format_opportunity",
    "underused_channel",
    "content_theme",
  ];
  for (const type of priority) {
    const match = opportunities.find((o) => o.type === type);
    if (match) return match;
  }
  return opportunities[0] ?? null;
}
