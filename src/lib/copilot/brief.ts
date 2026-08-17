import type { MarketingPriority } from "@/lib/copilot/priorities";
import type { CopilotSuggestedAction, EvidenceItem } from "@/lib/copilot/types";
import { createEvidence, formatCurrency, formatMultiplier, formatPercent } from "@/lib/copilot/format";

export type BriefSection = {
  title: string;
  items: string[];
};

export type DailyBriefInput = {
  periodLabel: string;
  changed: Array<{ label: string; change: string }>;
  attention: Array<{ title: string; reason: string; evidence: EvidenceItem[] }>;
  opportunities: Array<{ title: string; reason: string }>;
  risks: string[];
  contentGaps: string[];
  dataQuality: string;
  priorities: MarketingPriority[];
};

export function buildDailyBrief(input: DailyBriefInput): {
  sections: BriefSection[];
  answer: string;
  actions: CopilotSuggestedAction[];
} {
  const sections: BriefSection[] = [
    { title: "What changed", items: input.changed.map((item) => `${item.label}: ${item.change}`) },
    {
      title: "Needs attention",
      items: input.attention.map((item) => `${item.title} — ${item.reason}`),
    },
    {
      title: "Opportunities",
      items: input.opportunities.map((item) => `${item.title} — ${item.reason}`),
    },
    { title: "Risks", items: input.risks },
    { title: "Content", items: input.contentGaps },
    { title: "Data quality", items: [input.dataQuality] },
    {
      title: "Recommended actions",
      items: input.priorities.slice(0, 3).map((item, index) => `${index + 1}. ${item.title}`),
    },
  ];

  const answer = [
    `Today — ${input.periodLabel}`,
    ...sections.flatMap((section) =>
      section.items.length > 0 ? [`${section.title.toUpperCase()}`, ...section.items.map((item) => `• ${item}`)] : [],
    ),
  ].join("\n\n");

  const actions: CopilotSuggestedAction[] = input.priorities
    .slice(0, 3)
    .map((priority) => priority.action)
    .filter((action): action is CopilotSuggestedAction => action != null);

  return { sections, answer, actions };
}

export function metricChangeLabel(
  current: number | null,
  previous: number | null,
  formatter: (value: number) => string = (value) => String(value),
): string | null {
  if (current == null || previous == null || previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  return `${formatter(current)} (${formatPercent(change)} vs comparison period)`;
}

export function roasChangeLabel(current: number | null, previous: number | null): string | null {
  if (current == null || previous == null) return null;
  return `${formatMultiplier(current)} (was ${formatMultiplier(previous)})`;
}

export function spendChangeLabel(current: number, previous: number): string | null {
  return metricChangeLabel(current, previous, formatCurrency);
}
