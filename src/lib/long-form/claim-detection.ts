import type { LongFormClaimClassification } from "@prisma/client";

export type DetectedClaim = {
  claimText: string;
  classification: LongFormClaimClassification;
  isSupported: boolean;
  requiresCitation: boolean;
  flagged: boolean;
  flagReason?: string;
};

const FACTUAL_PATTERNS = [
  /\b\d+%\b/,
  /\b\d{4}\b/,
  /\b(studies show|research shows|according to|data shows|proven|guaranteed)\b/i,
  /\b(increased|decreased|reduced|improved) by\b/i,
  /\b(is the (largest|best|leading|only))\b/i,
];

const OPINION_PATTERNS = [
  /\b(we believe|in our view|we think|arguably|perhaps)\b/i,
  /\b(may|might|could)\b/i,
];

const MARKETING_PATTERNS = [
  /\b(best-in-class|world-class|revolutionary|game-changing|unmatched)\b/i,
  /\b(guaranteed|promise|always|never fails)\b/i,
];

export function detectClaimsInText(text: string): DetectedClaim[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  return sentences.map((sentence) => classifyClaim(sentence));
}

export function classifyClaim(claimText: string): DetectedClaim {
  const lower = claimText.toLowerCase();

  if (MARKETING_PATTERNS.some((p) => p.test(claimText))) {
    return {
      claimText,
      classification: "MARKETING_STATEMENT",
      isSupported: false,
      requiresCitation: true,
      flagged: true,
      flagReason: "Marketing superlative or guarantee language detected.",
    };
  }

  if (OPINION_PATTERNS.some((p) => p.test(claimText))) {
    return {
      claimText,
      classification: "OPINION",
      isSupported: true,
      requiresCitation: false,
      flagged: false,
    };
  }

  if (FACTUAL_PATTERNS.some((p) => p.test(claimText))) {
    return {
      claimText,
      classification: "CITATION_REQUIRED",
      isSupported: false,
      requiresCitation: true,
      flagged: true,
      flagReason: "Factual claim requires citation or evidence.",
    };
  }

  if (/\b(our (product|platform|service|tool))\b/i.test(claimText)) {
    return {
      claimText,
      classification: "INTERNAL_SOURCE",
      isSupported: false,
      requiresCitation: true,
      flagged: false,
    };
  }

  if (/\b(unverifiable|cannot be verified|no data)\b/i.test(lower)) {
    return {
      claimText,
      classification: "UNVERIFIABLE",
      isSupported: false,
      requiresCitation: false,
      flagged: true,
      flagReason: "Claim appears unverifiable.",
    };
  }

  return {
    claimText,
    classification: "OPINION",
    isSupported: true,
    requiresCitation: false,
    flagged: false,
  };
}

export function flagUnsupportedClaims(claims: DetectedClaim[]): DetectedClaim[] {
  return claims.map((c) => {
    if (c.requiresCitation && !c.isSupported) {
      return { ...c, flagged: true, flagReason: c.flagReason ?? "Unsupported claim requires citation." };
    }
    return c;
  });
}

export function validateCitationNotFabricated(citation: {
  url?: string | null;
  label: string;
  knownSources?: string[];
}): { isFabricated: boolean; reason?: string } {
  if (!citation.url) {
    return { isFabricated: false };
  }
  try {
    const url = new URL(citation.url);
    if (!["http:", "https:"].includes(url.protocol)) {
      return { isFabricated: true, reason: "Invalid citation URL protocol." };
    }
  } catch {
    return { isFabricated: true, reason: "Malformed citation URL." };
  }
  if (citation.knownSources?.length && !citation.knownSources.some((s) => citation.url?.includes(s))) {
    return { isFabricated: false };
  }
  return { isFabricated: false };
}
