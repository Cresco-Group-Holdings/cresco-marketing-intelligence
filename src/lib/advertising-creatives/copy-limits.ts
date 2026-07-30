export type CopyFieldKey =
  | "headline"
  | "longHeadline"
  | "primaryText"
  | "description"
  | "cta"
  | "displayPath"
  | "callout"
  | "sitelink"
  | "videoHook"
  | "caption"
  | "thumbnailText";

export type CopyFieldResult = {
  fieldKey: CopyFieldKey;
  value: string;
  characterCount: number;
  maxLength: number | null;
  valid: boolean;
  truncationWarning: string | null;
};

export function validateCopyField(
  fieldKey: CopyFieldKey,
  value: string,
  maxLength: number | null,
): CopyFieldResult {
  const characterCount = value.length;
  const valid = maxLength === null || characterCount <= maxLength;
  let truncationWarning: string | null = null;

  if (maxLength !== null && characterCount > maxLength) {
    truncationWarning = `Field "${fieldKey}" exceeds provider limit of ${maxLength} characters (${characterCount}). Do not truncate silently — shorten the copy.`;
  }

  return {
    fieldKey,
    value,
    characterCount,
    maxLength,
    valid,
    truncationWarning,
  };
}

export function validateCopyFields(
  fields: Array<{ fieldKey: CopyFieldKey; value: string; maxLength: number | null }>,
): { results: CopyFieldResult[]; allValid: boolean } {
  const results = fields.map((f) => validateCopyField(f.fieldKey, f.value, f.maxLength));
  return { results, allValid: results.every((r) => r.valid) };
}
