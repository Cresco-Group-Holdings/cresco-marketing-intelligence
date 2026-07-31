import type { InternalLinkAnchorType } from "@prisma/client";
import { GENERIC_ANCHORS, NAVIGATIONAL_ANCHORS } from "@/lib/internal-links/constants";

export function classifyAnchor(
  anchorText: string | null | undefined,
  options?: { brandName?: string; targetKeyword?: string; isImageLink?: boolean },
): InternalLinkAnchorType {
  if (options?.isImageLink) return "IMAGE";
  const text = (anchorText ?? "").trim();
  if (!text) return "EMPTY";

  const lower = text.toLowerCase();
  if (GENERIC_ANCHORS.has(lower)) return "GENERIC";
  if (NAVIGATIONAL_ANCHORS.has(lower)) return "NAVIGATIONAL";

  if (options?.brandName && lower.includes(options.brandName.toLowerCase())) {
    return "BRANDED";
  }

  if (options?.targetKeyword) {
    const kw = options.targetKeyword.toLowerCase();
    if (lower === kw) return "PARTIAL_MATCH";
    if (lower.includes(kw) || kw.includes(lower)) return "PARTIAL_MATCH";
  }

  if (text.length > 20) return "DESCRIPTIVE";
  return "DESCRIPTIVE";
}

export function detectAnchorRepetition(
  anchors: Array<{ text: string; count: number }>,
  threshold = 5,
): Array<{ text: string; count: number; warning: string }> {
  return anchors
    .filter((a) => a.count >= threshold && a.text.trim().length > 0)
    .map((a) => ({
      ...a,
      warning: `Anchor "${a.text}" used ${a.count} times — may appear unnatural.`,
    }));
}

export function warnExactMatchOveruse(
  anchors: Array<{ text: string; classification: string; count: number }>,
): string[] {
  const warnings: string[] = [];
  const partialMatches = anchors.filter((a) => a.classification === "PARTIAL_MATCH");
  for (const a of partialMatches) {
    if (a.count >= 3) {
      warnings.push(`Exact/partial-match anchor "${a.text}" repeated ${a.count} times. Consider descriptive alternatives.`);
    }
  }
  return warnings;
}
