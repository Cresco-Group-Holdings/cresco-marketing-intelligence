export const APPROVED_TEMPLATE_VARIABLES = [
  "firstName",
  "lastName",
  "fullName",
  "company",
  "product",
  "ownerName",
  "meetingDate",
  "trialEnd",
  "opportunityStage",
] as const;

export type ApprovedVariable = (typeof APPROVED_TEMPLATE_VARIABLES)[number];

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;
const CRM_FIELD_PREFIX = "crm.";

export function extractTemplateVariables(content: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(VARIABLE_PATTERN.source, "g");
  while ((match = regex.exec(content)) !== null) {
    found.add(match[1]!);
  }
  return [...found];
}

export function validateTemplateVariables(
  variables: string[],
  allowedCrmFields: string[] = [],
): { valid: boolean; errors: string[]; approved: string[] } {
  const errors: string[] = [];
  const approved: string[] = [];
  for (const v of variables) {
    if ((APPROVED_TEMPLATE_VARIABLES as readonly string[]).includes(v)) {
      approved.push(v);
    } else if (v.startsWith(CRM_FIELD_PREFIX)) {
      const field = v.slice(CRM_FIELD_PREFIX.length);
      if (allowedCrmFields.includes(field)) {
        approved.push(v);
      } else {
        errors.push(`CRM field "${field}" is not permitted.`);
      }
    } else {
      errors.push(`Variable "${v}" is not in the approved list.`);
    }
  }
  return { valid: errors.length === 0, errors, approved };
}

export function renderTemplate(
  content: string,
  values: Record<string, string | undefined>,
): { rendered: string; missing: string[] } {
  const missing: string[] = [];
  const rendered = content.replace(VARIABLE_PATTERN, (_, key: string) => {
    const value = values[key];
    if (value === undefined || value === "") {
      missing.push(key);
      return "";
    }
    return value;
  });
  return { rendered, missing };
}
