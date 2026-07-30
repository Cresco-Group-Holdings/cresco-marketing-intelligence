import type { CrmCustomFieldType } from "@prisma/client";

const ALLOWED_FIELD_TYPES: CrmCustomFieldType[] = [
  "TEXT", "LONG_TEXT", "NUMBER", "BOOLEAN", "DATE", "DATETIME",
  "SINGLE_SELECT", "MULTI_SELECT", "URL", "EMAIL", "PHONE", "CURRENCY",
];

export function validateCustomFieldDefinition(input: {
  fieldKey: string;
  label: string;
  fieldType: string;
  options?: string[];
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!/^[a-z][a-z0-9_]{1,48}$/.test(input.fieldKey)) {
    errors.push("Field key must be lowercase snake_case, 2-49 chars.");
  }
  if (!input.label?.trim()) errors.push("Label is required.");
  if (!ALLOWED_FIELD_TYPES.includes(input.fieldType as CrmCustomFieldType)) {
    errors.push(`Invalid field type: ${input.fieldType}`);
  }
  if (["SINGLE_SELECT", "MULTI_SELECT"].includes(input.fieldType) && (!input.options || input.options.length === 0)) {
    errors.push("Select fields require options.");
  }
  return { valid: errors.length === 0, errors };
}

export function validateCustomFieldValue(
  fieldType: CrmCustomFieldType,
  value: unknown,
  options?: string[],
): { valid: boolean; error?: string } {
  switch (fieldType) {
    case "NUMBER":
    case "CURRENCY":
      if (typeof value !== "number" && isNaN(Number(value))) return { valid: false, error: "Must be a number." };
      break;
    case "BOOLEAN":
      if (typeof value !== "boolean") return { valid: false, error: "Must be boolean." };
      break;
    case "EMAIL":
      if (typeof value !== "string" || !value.includes("@")) return { valid: false, error: "Must be valid email." };
      break;
    case "SINGLE_SELECT":
      if (options && !options.includes(String(value))) return { valid: false, error: "Invalid option." };
      break;
    default:
      break;
  }
  return { valid: true };
}
