import { DRAFT_TYPES, PROHIBITED_COMMERCIAL_ACTIONS } from "./constants";

export type DraftInput = {
  draftType: string;
  subject?: string;
  body: string;
  entityId?: string;
  entityType?: string;
};

export type DraftValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

const FAKE_URGENCY_PATTERNS = [
  /\bact now\b/i,
  /\blimited time only\b/i,
  /\bexpires today\b/i,
  /\blast chance\b/i,
  /\bdon'?t miss out\b/i,
  /\boffer ends (tonight|today|soon)\b/i,
  /\bimmediate action required\b/i,
  /\bfinal (notice|warning|reminder)\b/i,
];

const PRICING_PATTERNS = [
  /\$\d+/,
  /£\d+/,
  /€\d+/,
  /\b\d+%\s*(off|discount|savings)\b/i,
  /\bprice[ds]?\s+(at|of|reduced to)\s+\d/i,
  /\bspecial\s+(rate|price|offer)\b/i,
  /\bwe can offer you\b/i,
];

const DISCOUNT_PATTERNS = [
  /\b\d+%\s*discount\b/i,
  /\bexclusive\s+discount\b/i,
  /\breduced\s+rate\b/i,
  /\bwaive[ds]?\s+(the\s+)?fee/i,
  /\bfree\s+(month|trial\s+extension|upgrade)\b/i,
];

const FABRICATED_PROMISE_PATTERNS = [
  /\bguarantee[ds]?\s+(results?|success|roi)\b/i,
  /\bwe promise\b/i,
  /\byou will (definitely|certainly|surely)\b/i,
  /\b100%\s+(success|satisfaction|guaranteed)\b/i,
  /\bapproved\s+by\s+(legal|management)\b/i,
];

export function validateDraft(input: DraftInput): DraftValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(DRAFT_TYPES as readonly string[]).includes(input.draftType)) {
    errors.push(`Invalid draft type: ${input.draftType}`);
  }

  if (!input.body?.trim()) {
    errors.push("Draft body is required.");
  }

  if (input.draftType === "EMAIL" && !input.subject?.trim()) {
    warnings.push("Email draft has no subject line.");
  }

  const safety = checkDraftSafety(input);
  errors.push(...safety.blockedReasons);
  warnings.push(...safety.warnings);

  return { valid: errors.length === 0, errors, warnings };
}

export function checkDraftSafety(input: DraftInput): {
  safe: boolean;
  blockedReasons: string[];
  warnings: string[];
  prohibitedActions: string[];
} {
  const blockedReasons: string[] = [];
  const warnings: string[] = [];
  const prohibitedActions: string[] = [];
  const text = `${input.subject ?? ""} ${input.body}`;

  if (FAKE_URGENCY_PATTERNS.some((p) => p.test(text))) {
    blockedReasons.push("Draft contains fabricated or unverifiable urgency language.");
    prohibitedActions.push("FABRICATED_URGENCY");
  }

  if (PRICING_PATTERNS.some((p) => p.test(text))) {
    blockedReasons.push("Draft contains unverified pricing. Pricing must be confirmed by a human.");
    prohibitedActions.push("UNVERIFIED_PRICING");
  }

  if (DISCOUNT_PATTERNS.some((p) => p.test(text))) {
    blockedReasons.push("Draft contains unverified discount offers. Discounts require explicit approval.");
    prohibitedActions.push("UNVERIFIED_DISCOUNT");
  }

  if (FABRICATED_PROMISE_PATTERNS.some((p) => p.test(text))) {
    blockedReasons.push("Draft contains fabricated promises or guarantees.");
    prohibitedActions.push("FABRICATED_PROMISE");
  }

  if (/\bauto-?send\b/i.test(text) || /\bsending this (now|immediately)\b/i.test(text)) {
    blockedReasons.push("Draft implies automatic sending, which is prohibited.");
    prohibitedActions.push("AUTO_SEND_MESSAGE");
  }

  const uniqueProhibited = [...new Set(prohibitedActions)].filter((a) =>
    (PROHIBITED_COMMERCIAL_ACTIONS as readonly string[]).includes(a),
  );

  if (!text.includes("[Draft only") && !text.includes("review before sending")) {
    warnings.push('Draft should include "review before sending" guidance.');
  }

  return {
    safe: blockedReasons.length === 0,
    blockedReasons,
    warnings,
    prohibitedActions: uniqueProhibited,
  };
}
