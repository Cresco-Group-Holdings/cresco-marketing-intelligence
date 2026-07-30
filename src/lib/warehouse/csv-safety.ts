const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Neutralises CSV formula-injection prefixes so spreadsheet tools do not execute cell values.
 */
export function sanitizeCsvCell(value: string): string {
  const trimmed = value.trim();
  if (FORMULA_PREFIX.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

export function sanitizeCsvRow(row: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, sanitizeCsvCell(value)]),
  );
}
