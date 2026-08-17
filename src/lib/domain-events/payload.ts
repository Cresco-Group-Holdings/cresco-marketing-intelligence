import type { Prisma } from "@prisma/client";

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Serializes a domain payload into Prisma's JSON input shape.
 * Uses JSON round-trip so only JSON-serializable values cross the persistence boundary.
 */
export function toInputJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function readStoredPayload(value: unknown): Record<string, unknown> {
  return isJsonObject(value) ? value : {};
}

export function readLeadIdFromPayload(
  payload: Record<string, unknown>,
  resourceId: string,
): string {
  const candidate = payload.leadId;
  if (typeof candidate === "string" && candidate.length > 0) {
    return candidate;
  }
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return String(candidate);
  }
  return resourceId;
}
