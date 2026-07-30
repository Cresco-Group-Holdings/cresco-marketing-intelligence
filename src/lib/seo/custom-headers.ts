const ALLOWED_HEADER_NAMES = new Set([
  "accept",
  "accept-language",
  "accept-encoding",
  "cache-control",
]);

const FORBIDDEN_HEADER_PATTERNS = [
  /^authorization$/i,
  /^cookie$/i,
  /^x-forwarded/i,
  /^x-real-ip$/i,
  /^host$/i,
  /^proxy-/i,
];

export function sanitiseCrawlCustomHeaders(
  headers?: Record<string, string> | null,
): Record<string, string> | undefined {
  if (!headers || typeof headers !== "object") return undefined;

  const sanitised: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase().trim();
    if (!ALLOWED_HEADER_NAMES.has(lower)) continue;
    if (FORBIDDEN_HEADER_PATTERNS.some((p) => p.test(lower))) continue;
    if (typeof value !== "string" || value.length > 500) continue;
    if (/[\r\n]/.test(value)) continue;
    sanitised[lower] = value.trim();
  }

  return Object.keys(sanitised).length > 0 ? sanitised : undefined;
}
