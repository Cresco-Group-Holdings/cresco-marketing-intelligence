export const KNOWLEDGE_DOCUMENT_MAX_SIZE_BYTES = 25 * 1024 * 1024;

export const KNOWLEDGE_DOCUMENT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
] as const;

export const KNOWLEDGE_DOCUMENT_ALLOWED_EXTENSIONS = [
  ".pdf",
  ".txt",
  ".md",
  ".csv",
  ".docx",
  ".doc",
] as const;

export const KNOWLEDGE_DOCUMENT_BLOCKED_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".php",
  ".sh",
  ".ps1",
  ".vbs",
  ".jar",
  ".html",
  ".htm",
] as const;

export const KNOWLEDGE_DOCUMENT_SIGNED_URL_TTL_SECONDS = 300;

export const KNOWLEDGE_DEFAULT_BASE_NAME = "Brand Knowledge Base";

export const KNOWLEDGE_ENTRY_TYPE_LABELS: Record<string, string> = {
  BRAND_GUIDELINE: "Brand guideline",
  TONE_OF_VOICE: "Tone of voice",
  PRODUCT: "Product",
  SERVICE: "Service",
  AUDIENCE: "Audience",
  PERSONA: "Persona",
  ICP: "ICP",
  COMPETITOR: "Competitor",
  FAQ: "FAQ",
  CASE_STUDY: "Case study",
  APPROVED_CLAIM: "Approved claim",
  PROHIBITED_CLAIM: "Prohibited claim",
  POLICY: "Policy",
  CAMPAIGN_CONTEXT: "Campaign context",
  SALES_MATERIAL: "Sales material",
  GENERAL: "General",
};

export const KNOWLEDGE_ENTRY_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};
