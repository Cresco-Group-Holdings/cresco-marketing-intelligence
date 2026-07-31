export type EvidenceRef = {
  source: string;
  key: string;
  value: unknown;
  observedAt?: string;
};

export type FindingWithEvidence = {
  title: string;
  description: string;
  evidence: EvidenceRef[];
};

export function buildEvidence(
  source: string,
  key: string,
  value: unknown,
  observedAt?: Date,
): EvidenceRef {
  return {
    source,
    key,
    value,
    observedAt: observedAt?.toISOString(),
  };
}

export function validateFindingHasEvidence(evidence: EvidenceRef[]): boolean {
  return evidence.length > 0 && evidence.every((e) => e.source && e.key);
}

export function linkEvidenceToFinding(
  finding: Omit<FindingWithEvidence, "evidence">,
  refs: EvidenceRef[],
): FindingWithEvidence {
  if (!validateFindingHasEvidence(refs)) {
    throw new Error("Every finding requires at least one evidence reference.");
  }
  return { ...finding, evidence: refs };
}
