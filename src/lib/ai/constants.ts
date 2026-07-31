import type { AIPurpose } from "@prisma/client";

export const AI_MAX_INPUT_CHARACTERS = 12_000;
export const AI_MAX_OUTPUT_TOKENS_DEFAULT = 1_024;
export const AI_REQUEST_TIMEOUT_MS = 30_000;
export const AI_MAX_RETRIES = 2;
export const AI_RETRY_BASE_DELAY_MS = 500;

export const AI_ALLOWED_PURPOSES: AIPurpose[] = [
  "DIAGNOSTICS_TEST",
  "BRAND_CONTEXT_SUMMARY",
  "CONTENT_DRAFT",
  "SEO_ANALYSIS",
  "ANALYTICS_INSIGHT",
  "SALES_ASSIST",
  "LEAD_QUALIFICATION_SUGGEST",
  "ADVERTISING_PLANNING",
  "ADVERTISING_CREATIVE",
  "ADVERTISING_AUDIENCE",
  "COMPLIANCE_REVIEW_SUGGEST",
  "INBOX_REPLY_SUGGEST",
];

export const AI_PER_REQUEST_TOKEN_LIMIT = 8_000;
export const AI_ORGANISATION_DAILY_TOKEN_LIMIT = 250_000;
export const AI_USER_DAILY_TOKEN_LIMIT = 50_000;

export const AI_OUTPUT_PREVIEW_MAX_CHARS = 500;

export const SENSITIVE_DATA_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /\b(?:sk|pk)_[A-Za-z0-9]{10,}\b/g,
  /\bAIza[0-9A-Za-z\-_]{10,}\b/g,
  /\bpassword\s*[:=]\s*\S+/gi,
  /\bapi[_-]?key\s*[:=]\s*\S+/gi,
  /\bsecret\s*[:=]\s*\S+/gi,
  /\bcookie\s*[:=]\s*\S+/gi,
] as const;

export const PROMPT_INJECTION_PATTERNS = [
  /ignore (all|previous|above) instructions/i,
  /disregard (the )?(system|developer) (prompt|message|instructions)/i,
  /you are now/i,
  /reveal (the )?(system|hidden) prompt/i,
] as const;
