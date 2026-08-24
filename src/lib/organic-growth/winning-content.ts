import type { WinningContentItem } from "@/lib/organic-growth/types";

export type ContentPerformanceInput = {
  id: string;
  title: string;
  channel: string;
  format: string | null;
  theme: string | null;
  publishedAt: string | null;
  reach: number | null;
  engagements: number | null;
  engagementRate: number | null;
  profileVisits: number | null;
  clicks: number | null;
};

export type WinningContentOptions = {
  minSampleSize?: number;
  minLiftRatio?: number;
  comparisonWindow?: string;
};

const DEFAULT_MIN_SAMPLE = 3;
const DEFAULT_MIN_LIFT = 1.5;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function evidenceStrengthFromSample(
  sampleSize: number,
  lift: number,
): "emerging" | "moderate" | "strong" {
  if (sampleSize >= 10 && lift >= 2) return "strong";
  if (sampleSize >= 5 && lift >= 1.5) return "moderate";
  return "emerging";
}

function confidenceFromSample(sampleSize: number, lift: number): "low" | "medium" | "high" {
  if (sampleSize >= 10 && lift >= 2) return "high";
  if (sampleSize >= 5 && lift >= 1.5) return "medium";
  return "low";
}

export function detectWinningContent(
  items: ContentPerformanceInput[],
  options: WinningContentOptions = {},
): WinningContentItem[] {
  const minSample = options.minSampleSize ?? DEFAULT_MIN_SAMPLE;
  const minLift = options.minLiftRatio ?? DEFAULT_MIN_LIFT;
  const comparisonWindow = options.comparisonWindow ?? "the last 30 days";

  if (items.length < minSample) {
    return [];
  }

  const engagementRates = items
    .map((item) => item.engagementRate)
    .filter((value): value is number => value != null && value > 0);
  const accountBaseline = median(engagementRates);
  if (accountBaseline == null || accountBaseline <= 0) {
    return [];
  }

  const profileVisitBaselines = items
    .map((item) => item.profileVisits)
    .filter((value): value is number => value != null && value > 0);
  const clickBaselines = items
    .map((item) => item.clicks)
    .filter((value): value is number => value != null && value > 0);
  const profileVisitMedian = median(profileVisitBaselines);
  const clickMedian = median(clickBaselines);

  const winners: WinningContentItem[] = [];

  for (const item of items) {
    if (item.engagementRate == null || item.engagementRate <= 0) continue;

    const engagementLift = item.engagementRate / accountBaseline;
    if (engagementLift < minLift) continue;

    const profileVisitLift =
      item.profileVisits != null && profileVisitMedian != null && profileVisitMedian > 0
        ? item.profileVisits / profileVisitMedian
        : null;
    const clickLift =
      item.clicks != null && clickMedian != null && clickMedian > 0
        ? item.clicks / clickMedian
        : null;

    const confidence = confidenceFromSample(items.length, engagementLift);
    const evidenceStrength = evidenceStrengthFromSample(items.length, engagementLift);
    const evidenceParts = [
      `${engagementLift.toFixed(1)}× account median engagement`,
    ];
    if (profileVisitLift != null && profileVisitLift >= 1.3) {
      evidenceParts.push(`${profileVisitLift.toFixed(1)}× profile visits`);
    }
    if (clickLift != null && clickLift >= 1.3) {
      evidenceParts.push(`${clickLift.toFixed(1)}× website clicks`);
    }

    winners.push({
      id: item.id,
      title: item.title,
      channel: item.channel,
      format: item.format,
      publishedAt: item.publishedAt,
      reach: item.reach,
      engagements: item.engagements,
      engagementRate: item.engagementRate,
      profileVisits: item.profileVisits,
      clicks: item.clicks,
      baselineEngagementRate: accountBaseline,
      engagementLift,
      profileVisitLift,
      clickLift,
      confidence,
      evidenceStrength,
      evidenceLabel: evidenceParts.join(" · "),
      baselineDescription: `Compared with your account median for ${comparisonWindow}`,
      sampleSize: items.length,
      comparisonWindow,
      disclaimer: "Performance signal based on observed account data — not causal evidence.",
      theme: item.theme,
      actions: [
        { label: "Repurpose", href: `/content/studio/${item.id}?action=repurpose` },
        { label: "Create variants", href: `/content/studio/${item.id}?action=variants` },
        { label: "Create experiment", href: `/growth/experiments/new?source=${item.id}` },
      ],
    });
  }

  return winners
    .sort((a, b) => (b.engagementLift ?? 0) - (a.engagementLift ?? 0))
    .slice(0, 5);
}
