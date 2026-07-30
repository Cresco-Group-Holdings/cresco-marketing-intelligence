import { BRIEF_MAX_COMPETITOR_EXCERPT, BRIEF_MAX_HEADING_LENGTH } from "@/lib/briefs/constants";

export function truncateCompetitorExcerpt(text: string): string {
  if (text.length <= BRIEF_MAX_COMPETITOR_EXCERPT) return text;
  return `${text.slice(0, BRIEF_MAX_COMPETITOR_EXCERPT)}…`;
}

export function sanitiseCompetitorHeading(text: string): string {
  return text.slice(0, BRIEF_MAX_HEADING_LENGTH);
}

export function competitorEvidenceDisclaimer(): string {
  return "Competitor evidence is for coverage and gap analysis only. Do not reproduce competitor articles, copy outlines mechanically, or treat competitor headings as mandatory.";
}

export function validateBriefDoesNotInstructPlagiarism(output: {
  recommendedAngle?: string;
  outline?: string[];
  originalityGuidance?: string;
}): string[] {
  const warnings: string[] = [];
  const plagiarismPatterns = [
    /copy\s+(the\s+)?competitor/i,
    /replicate\s+(their|competitor)/i,
    /use\s+the\s+same\s+outline/i,
    /mirror\s+competitor/i,
  ];
  const text = [output.recommendedAngle, output.originalityGuidance, ...(output.outline ?? [])].join(" ");
  for (const pattern of plagiarismPatterns) {
    if (pattern.test(text)) warnings.push(`Potential plagiarism instruction detected: ${pattern.source}`);
  }
  if (!output.originalityGuidance?.toLowerCase().includes("original")) {
    warnings.push("Missing explicit originality guidance.");
  }
  return warnings;
}
