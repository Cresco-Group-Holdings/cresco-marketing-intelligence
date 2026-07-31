import { sanitizeCsvCell } from "@/lib/warehouse/csv-safety";

export type CsvRow = Record<string, string>;

export function sanitiseCsvRow(row: CsvRow): CsvRow {
  const sanitised: CsvRow = {};
  for (const [key, value] of Object.entries(row)) {
    sanitised[key] = sanitizeCsvCell(value);
  }
  return sanitised;
}

export function validateImportMapping(
  mapping: Record<string, string>,
  requiredFields: string[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const mappedTargets = new Set(Object.values(mapping));
  for (const field of requiredFields) {
    if (!mappedTargets.has(field)) {
      errors.push(`Required field not mapped: ${field}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function buildIdempotencyKey(organisationId: string, fileName: string, rowHash: string): string {
  return `${organisationId}:${fileName}:${rowHash}`;
}

export function minimiseExportRow(
  row: Record<string, unknown>,
  visibleFields: string[],
): Record<string, unknown> {
  const minimised: Record<string, unknown> = {};
  for (const field of visibleFields) {
    if (row[field] !== undefined) minimised[field] = row[field];
  }
  return minimised;
}
