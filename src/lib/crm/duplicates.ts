import { normaliseEmail, normalisePhone } from "./contact-normalisation";

export type DuplicateEvidence = {
  type: string;
  value: string;
  confidence: "HIGH" | "MEDIUM";
};

export type DuplicateMatchInput = {
  email?: string | null;
  phone?: string | null;
  externalProvider?: string | null;
  externalId?: string | null;
  authUserId?: string | null;
  companyDomain?: string | null;
  exactName?: string | null;
};

export function buildDuplicateEvidence(input: DuplicateMatchInput): DuplicateEvidence[] {
  const evidence: DuplicateEvidence[] = [];
  const email = input.email ? normaliseEmail(input.email) : null;
  if (email) evidence.push({ type: "exact_verified_email", value: email, confidence: "HIGH" });
  const phone = input.phone ? normalisePhone(input.phone) : null;
  if (phone) evidence.push({ type: "exact_normalised_phone", value: phone, confidence: "HIGH" });
  if (input.externalProvider && input.externalId) {
    evidence.push({ type: "same_external_provider_id", value: `${input.externalProvider}:${input.externalId}`, confidence: "HIGH" });
  }
  if (input.authUserId) {
    evidence.push({ type: "same_authenticated_user_id", value: input.authUserId, confidence: "HIGH" });
  }
  if (input.companyDomain && input.exactName) {
    evidence.push({
      type: "company_domain_plus_exact_name",
      value: `${input.companyDomain}:${input.exactName.trim().toLowerCase()}`,
      confidence: "MEDIUM",
    });
  }
  return evidence;
}

export function canAutoMerge(evidence: DuplicateEvidence[]): boolean {
  const autoMergeTypes = ["exact_verified_email", "exact_normalised_phone", "same_authenticated_user_id", "same_external_provider_id"];
  return evidence.length === 1 && autoMergeTypes.includes(evidence[0].type) && evidence[0].confidence === "HIGH";
}
