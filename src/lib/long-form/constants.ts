export const LONG_FORM_CONTENT_TYPES = [
  "BLOG_ARTICLE",
  "GUIDE",
  "LANDING_PAGE",
  "COMPARISON",
  "CASE_STUDY",
  "FAQ",
  "GLOSSARY",
  "DOCUMENTATION",
  "PILLAR_PAGE",
  "SUPPORTING_ARTICLE",
] as const;

export type LongFormContentTypeValue = (typeof LONG_FORM_CONTENT_TYPES)[number];

export const LONG_FORM_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["OUTLINE_PENDING", "ARCHIVED"],
  OUTLINE_PENDING: ["OUTLINE_CONFIRMED", "DRAFT", "ARCHIVED"],
  OUTLINE_CONFIRMED: ["SECTIONS_GENERATING", "OUTLINE_PENDING", "ARCHIVED"],
  SECTIONS_GENERATING: ["SECTIONS_DRAFT", "ARCHIVED"],
  SECTIONS_DRAFT: ["EVIDENCE_REVIEW", "SECTIONS_GENERATING", "ARCHIVED"],
  EVIDENCE_REVIEW: ["SEO_REVIEW", "SECTIONS_DRAFT", "ARCHIVED"],
  SEO_REVIEW: ["COMPLIANCE_REVIEW", "EVIDENCE_REVIEW", "ARCHIVED"],
  COMPLIANCE_REVIEW: ["PENDING_APPROVAL", "SEO_REVIEW", "ARCHIVED"],
  PENDING_APPROVAL: ["APPROVED", "SECTIONS_DRAFT", "ARCHIVED"],
  APPROVED: ["PUBLISH_READY", "ARCHIVED"],
  PUBLISH_READY: ["ARCHIVED"],
  ARCHIVED: [],
};

export const REVIEW_STAGE_ORDER = [
  "OUTLINE",
  "EVIDENCE",
  "SEO",
  "COMPLIANCE",
  "FINAL",
] as const;

export const SECTION_GENERATION_ACTIONS = [
  "SECTION_REGENERATE",
  "SHORTEN",
  "EXPAND",
  "CHANGE_TONE",
  "SIMPLIFY",
  "ADD_EXAMPLES",
  "REQUEST_EVIDENCE",
] as const;

export type SectionGenerationAction = (typeof SECTION_GENERATION_ACTIONS)[number];

export function assertStatusTransition(from: string, to: string): void {
  const allowed = LONG_FORM_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Cannot transition document from ${from} to ${to}.`);
  }
}
