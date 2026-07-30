import { DANGEROUS_HTML_PATTERN, FIELD_TYPES } from "./constants";

export type FormFieldDefinition = {
  fieldKey: string;
  fieldType: string;
  label: string;
  isRequired?: boolean;
  isHoneypot?: boolean;
  validationRules?: Record<string, unknown>;
  options?: Array<{ value: string; label: string }>;
};

export function sanitiseFieldText(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

export function validateFieldDefinition(field: FormFieldDefinition): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!/^[a-z][a-z0-9_]{1,48}$/.test(field.fieldKey)) {
    errors.push(`Invalid field key: ${field.fieldKey}`);
  }
  if (!(FIELD_TYPES as readonly string[]).includes(field.fieldType)) {
    errors.push(`Invalid field type: ${field.fieldType}`);
  }
  if (!field.label?.trim()) errors.push("Label is required.");
  if (DANGEROUS_HTML_PATTERN.test(field.label)) errors.push("Label contains disallowed content.");
  return { valid: errors.length === 0, errors };
}

export function validateSubmissionValue(
  field: FormFieldDefinition,
  value: unknown,
): { valid: boolean; error?: string } {
  if (field.isHoneypot) return { valid: true };
  const str = value === null || value === undefined ? "" : String(value);
  if (field.isRequired && !str.trim()) return { valid: false, error: `${field.label} is required.` };
  if (!str.trim()) return { valid: true };

  switch (field.fieldType) {
    case "EMAIL":
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) return { valid: false, error: "Invalid email." };
      break;
    case "URL":
      try { new URL(str); } catch { return { valid: false, error: "Invalid URL." }; }
      break;
    case "NUMBER":
      if (isNaN(Number(str))) return { valid: false, error: "Must be a number." };
      break;
    case "SINGLE_SELECT":
    case "RADIO":
      if (field.options && !field.options.some((o) => o.value === str)) {
        return { valid: false, error: "Invalid option." };
      }
      break;
    default:
      if (DANGEROUS_HTML_PATTERN.test(str)) return { valid: false, error: "Disallowed content." };
  }
  return { valid: true };
}

export function rejectUnknownFields(
  submittedKeys: string[],
  allowedKeys: string[],
): { valid: boolean; unknown: string[] } {
  const allowed = new Set(allowedKeys);
  const unknown = submittedKeys.filter((k) => !allowed.has(k) && !k.startsWith("_"));
  return { valid: unknown.length === 0, unknown };
}
