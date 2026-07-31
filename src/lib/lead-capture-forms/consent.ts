import { OPTIONAL_MARKETING_PURPOSES } from "./constants";

export type ConsentSubmission = {
  purpose: string;
  granted: boolean;
  wordingVersion: string;
};

export function validateConsentSubmissions(
  blocks: Array<{ purpose: string; isRequired: boolean; wordingVersion: string }>,
  submitted: ConsentSubmission[],
): { valid: boolean; errors: string[]; records: ConsentSubmission[] } {
  const errors: string[] = [];
  const submittedByPurpose = new Map(submitted.map((s) => [s.purpose, s]));
  const records: ConsentSubmission[] = [];

  for (const block of blocks) {
    const entry = submittedByPurpose.get(block.purpose);
    if (block.isRequired && (!entry || !entry.granted)) {
      errors.push(`Required consent not granted: ${block.purpose}`);
    }
    if (entry) {
      if (entry.wordingVersion !== block.wordingVersion) {
        errors.push(`Consent wording version mismatch for ${block.purpose}`);
      }
      records.push({
        purpose: block.purpose,
        granted: entry.granted,
        wordingVersion: block.wordingVersion,
      });
    } else if (block.isRequired) {
      records.push({ purpose: block.purpose, granted: false, wordingVersion: block.wordingVersion });
    }
  }

  const marketingWithoutService = submitted.filter(
    (s) => OPTIONAL_MARKETING_PURPOSES.includes(s.purpose as (typeof OPTIONAL_MARKETING_PURPOSES)[number]) && s.granted,
  );
  const serviceGranted = submitted.some((s) => s.purpose === "SERVICE_REQUEST" && s.granted);
  if (marketingWithoutService.length > 0 && !serviceGranted && blocks.some((b) => b.purpose === "SERVICE_REQUEST" && b.isRequired)) {
    // Service request must be separate — marketing cannot substitute for service consent
    const hasServiceBlock = blocks.some((b) => b.purpose === "SERVICE_REQUEST");
    if (hasServiceBlock && !serviceGranted) {
      errors.push("Service request consent is required separately from marketing consent.");
    }
  }

  return { valid: errors.length === 0, errors, records };
}
