import type { ContentQualityIssue, ContentQualityResult, MasterContent } from "@/lib/content-intelligence/types";

type QualityInput = {
  master: MasterContent;
  campaignObjective?: string | null;
  channel?: string | null;
  brandAlignmentWeak?: boolean;
  complianceIssue?: boolean;
  duplicateWarning?: string | null;
};

export function evaluateContentQuality(input: QualityInput): ContentQualityResult {
  const issues: ContentQualityIssue[] = [];

  if (!input.master.hook?.trim() && !input.master.body.slice(0, 120).includes("?")) {
    issues.push({
      id: "hook",
      severity: "warning",
      message: "Opening hook could be stronger to capture attention.",
      action: "Strengthen hook",
    });
  }

  if (!input.master.cta?.trim()) {
    issues.push({
      id: "cta-missing",
      severity: "warning",
      message: "No call-to-action detected.",
      action: "Add CTA",
    });
  } else if (
    input.campaignObjective &&
    input.master.cta &&
    !input.master.cta.toLowerCase().includes(input.campaignObjective.toLowerCase().slice(0, 8))
  ) {
    issues.push({
      id: "cta-alignment",
      severity: "info",
      message: "CTA may not be aligned with campaign objective.",
      action: "Review CTA",
    });
  }

  if (input.master.body.length < 80) {
    issues.push({
      id: "length",
      severity: "info",
      message: "Master content is very short — confirm this is intentional.",
    });
  }

  if (input.channel === "LINKEDIN" && input.master.body.length > 2800) {
    issues.push({
      id: "linkedin-length",
      severity: "warning",
      message: "LinkedIn version may exceed preferred structure for engagement.",
      action: "Shorten for LinkedIn",
    });
  }

  if (input.brandAlignmentWeak) {
    issues.push({
      id: "brand-alignment",
      severity: "warning",
      message: "Brand alignment could be improved before publication.",
      action: "Review brand alignment",
    });
  }

  if (input.complianceIssue) {
    issues.push({
      id: "compliance",
      severity: "warning",
      message: "Compliance check flagged potential issues.",
      action: "Run compliance check",
    });
  }

  if (input.duplicateWarning) {
    issues.push({
      id: "duplication",
      severity: "warning",
      message: input.duplicateWarning,
      action: "Change angle",
    });
  }

  return {
    issueCount: issues.length,
    issues,
    summary:
      issues.length === 0
        ? "No significant quality issues detected."
        : `${issues.length} improvement${issues.length === 1 ? "" : "s"} recommended`,
  };
}
