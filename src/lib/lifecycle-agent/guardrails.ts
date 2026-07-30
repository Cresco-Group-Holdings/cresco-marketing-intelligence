import { detectPromptInjection, sanitiseUserInput } from "@/lib/ai/prompt-injection";
import { PROHIBITED_COMMERCIAL_ACTIONS, STALE_CRM_DATA_HOURS } from "./constants";
import type { LifecycleAnalysisInput } from "./analysis-inputs";
import type { EvidencePackage } from "./evidence";

export type GuardrailResult = {
  passed: boolean;
  warnings: string[];
  blocked: boolean;
  blockReasons: string[];
  consentRestrictions: string[];
  commercialSafetyViolations: string[];
};

export function evaluateGuardrails(
  input: LifecycleAnalysisInput,
  evidence: EvidencePackage,
): GuardrailResult {
  const warnings: string[] = [];
  const blockReasons: string[] = [];
  const consentRestrictions: string[] = [];
  const commercialSafetyViolations: string[] = [];

  if (input.dataQuality.freshnessHours !== null && input.dataQuality.freshnessHours > STALE_CRM_DATA_HOURS) {
    warnings.push(
      `CRM data is ${input.dataQuality.freshnessHours}h old (threshold ${STALE_CRM_DATA_HOURS}h). Recommendations may be based on stale records.`,
    );
  }

  if (evidence.dataConfidenceLevel === "LOW") {
    blockReasons.push("CRM data confidence is LOW. Material recommendations suppressed.");
  }

  if (!input.dataQuality.hasOwnerCoverage) {
    warnings.push("Incomplete owner coverage across scoped records.");
  }

  if (input.consentContext && !input.consentContext.outreachAllowed) {
    consentRestrictions.push("Outreach is restricted by consent policy.");
    warnings.push("Consent policy restricts outreach. Draft and send actions require consent review.");
  }

  const restrictedLeads = input.leads.filter(
    (l) => l.suppressed || l.unsubscribed || l.consentGranted === false,
  );
  if (restrictedLeads.length > 0) {
    consentRestrictions.push(
      `${restrictedLeads.length} lead(s) have consent or suppression restrictions.`,
    );
  }

  if (input.userNotes && containsPersonalLeadData(input.userNotes)) {
    blockReasons.push("Input contains potential personal lead data. Remove PII before analysis.");
  }

  if (input.userNotes && detectCommercialSafetyViolation(input.userNotes)) {
    commercialSafetyViolations.push("User notes request prohibited commercial actions.");
    blockReasons.push("Input requests prohibited commercial actions (auto-send, pricing, deal won).");
  }

  return {
    passed: blockReasons.length === 0,
    warnings,
    blocked: blockReasons.length > 0,
    blockReasons,
    consentRestrictions,
    commercialSafetyViolations,
  };
}

export function blockAutonomousSend(approved: boolean): { allowed: boolean; reason: string } {
  if (!approved) {
    return {
      allowed: false,
      reason: "Messages are never sent autonomously. Human review and manual send required.",
    };
  }
  return { allowed: true, reason: "Manual send after human approval." };
}

export function blockAutonomousDealWon(approved: boolean, hasWonEvidence: boolean): {
  allowed: boolean;
  reason: string;
} {
  if (!approved || !hasWonEvidence) {
    return {
      allowed: false,
      reason: "Deals cannot be marked won without authorised confirmation and won evidence.",
    };
  }
  return { allowed: true, reason: "Won status may be applied with evidence and approval." };
}

export function blockAutonomousPriceChange(approved: boolean): { allowed: boolean; reason: string } {
  if (!approved) {
    return {
      allowed: false,
      reason: "Price changes are never applied autonomously.",
    };
  }
  return { allowed: true, reason: "Price change requires explicit human approval." };
}

const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
];

const COMMERCIAL_VIOLATION_PATTERNS: Array<{ pattern: RegExp; action: string }> = [
  { pattern: /\bauto[\s-]?send\b/i, action: "AUTO_SEND_MESSAGE" },
  { pattern: /\bmark\s+(as\s+)?won\b/i, action: "AUTO_DEAL_WON" },
  { pattern: /\b(change|update)\s+price\b/i, action: "AUTO_PRICE_CHANGE" },
  { pattern: /\bapply\s+discount\b/i, action: "AUTO_DISCOUNT" },
];

function containsPersonalLeadData(text: string): boolean {
  return PII_PATTERNS.some((p) => p.test(text));
}

function detectCommercialSafetyViolation(text: string): boolean {
  return COMMERCIAL_VIOLATION_PATTERNS.some(({ pattern, action }) =>
    pattern.test(text) && (PROHIBITED_COMMERCIAL_ACTIONS as readonly string[]).includes(action),
  );
}

export function sanitiseAnalysisNotes(notes: string): {
  safe: boolean;
  sanitised: string;
  blocked: boolean;
} {
  const sanitised = sanitiseUserInput(notes);
  if (detectPromptInjection(sanitised)) {
    return { safe: false, sanitised, blocked: true };
  }
  if (containsPersonalLeadData(sanitised)) {
    return { safe: false, sanitised, blocked: true };
  }
  if (detectCommercialSafetyViolation(sanitised)) {
    return { safe: false, sanitised, blocked: true };
  }
  return { safe: true, sanitised, blocked: false };
}

export function evaluateConsentForOutreach(
  lead: { suppressed?: boolean; unsubscribed?: boolean; consentGranted?: boolean; marketingConsent?: boolean },
  consentRequired: boolean,
): { allowed: boolean; reason: string } {
  if (lead.suppressed || lead.unsubscribed) {
    return { allowed: false, reason: "Contact is suppressed or unsubscribed." };
  }
  if (consentRequired && lead.consentGranted === false) {
    return { allowed: false, reason: "Explicit consent not granted." };
  }
  if (consentRequired && !lead.marketingConsent) {
    return { allowed: false, reason: "Marketing consent not recorded." };
  }
  return { allowed: true, reason: "Outreach permitted under consent policy." };
}
