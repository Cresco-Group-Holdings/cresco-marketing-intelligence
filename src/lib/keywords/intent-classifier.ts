import type { SeoKeywordIntentType } from "@prisma/client";

export type IntentClassification = {
  intent: SeoKeywordIntentType;
  confidence: number;
  source: "deterministic" | "ai";
  evidence: Record<string, unknown>;
};

const INFORMATIONAL_PATTERNS = [
  /^what (is|are|does|do)\b/i,
  /^how (to|do|does|can)\b/i,
  /^why (is|are|does|do)\b/i,
  /\b(guide|tutorial|meaning|definition|explained|examples?)\b/i,
  /\b(tips|ideas|ways to)\b/i,
];

const NAVIGATIONAL_PATTERNS = [
  /\b(login|sign in|website|official|portal)\b/i,
  /\b(brand name exact match patterns handled separately)\b/i,
];

const COMMERCIAL_PATTERNS = [
  /\b(best|top|review|compare|comparison|vs|alternative)\b/i,
  /\b(cheap|affordable|pricing|cost)\b/i,
];

const TRANSACTIONAL_PATTERNS = [
  /\b(buy|purchase|order|hire|book|apply|quote|get started)\b/i,
  /\b(near me|online|free trial|demo)\b/i,
];

const LOCAL_PATTERNS = [/\bnear me\b/i, /\bin [a-z]+\b/i, /\b(local|nearby)\b/i];

const SUPPORT_PATTERNS = [
  /\b(support|help|contact|customer service|troubleshoot|fix|error)\b/i,
];

export function classifyIntentDeterministic(
  keyword: string,
  brandName?: string,
): IntentClassification {
  const evidence: Record<string, unknown> = { keyword };
  const matches: SeoKeywordIntentType[] = [];

  if (brandName && keyword.toLowerCase().includes(brandName.toLowerCase())) {
    matches.push("NAVIGATIONAL");
    evidence.brandMatch = brandName;
  }

  for (const pattern of TRANSACTIONAL_PATTERNS) {
    if (pattern.test(keyword)) {
      matches.push("TRANSACTIONAL");
      evidence.transactionalPattern = pattern.source;
      break;
    }
  }

  for (const pattern of COMMERCIAL_PATTERNS) {
    if (pattern.test(keyword)) {
      matches.push("COMMERCIAL");
      evidence.commercialPattern = pattern.source;
      break;
    }
  }

  for (const pattern of LOCAL_PATTERNS) {
    if (pattern.test(keyword)) {
      matches.push("LOCAL");
      evidence.localPattern = pattern.source;
      break;
    }
  }

  for (const pattern of SUPPORT_PATTERNS) {
    if (pattern.test(keyword)) {
      matches.push("SUPPORT");
      evidence.supportPattern = pattern.source;
      break;
    }
  }

  for (const pattern of INFORMATIONAL_PATTERNS) {
    if (pattern.test(keyword)) {
      matches.push("INFORMATIONAL");
      evidence.informationalPattern = pattern.source;
      break;
    }
  }

  for (const pattern of NAVIGATIONAL_PATTERNS) {
    if (pattern.test(keyword)) {
      matches.push("NAVIGATIONAL");
      evidence.navigationalPattern = pattern.source;
      break;
    }
  }

  const unique = [...new Set(matches)];
  if (unique.length === 0) {
    return { intent: "UNKNOWN", confidence: 0.3, source: "deterministic", evidence };
  }
  if (unique.length > 1) {
    return { intent: "MIXED", confidence: 0.6, source: "deterministic", evidence: { ...evidence, intents: unique } };
  }

  return { intent: unique[0]!, confidence: 0.75, source: "deterministic", evidence };
}
