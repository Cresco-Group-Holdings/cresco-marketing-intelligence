import { createHash } from "node:crypto";

/**
 * Stable SHA-256 digest for deduplicating raw marketing payloads.
 * Objects are canonicalised via sorted JSON keys so field order does not affect the hash.
 */
export function hashPayload(payload: unknown): string {
  const canonical = canonicalise(payload);
  return createHash("sha256").update(canonical).digest("hex");
}

function canonicalise(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalise(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${canonicalise(nested)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}
