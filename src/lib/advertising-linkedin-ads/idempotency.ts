import { createHash } from "crypto";

export function buildLaunchIdempotencyKey(planId: string, planHash: string, version: number): string {
  return createHash("sha256").update(`linkedin:${planId}:${planHash}:${version}`).digest("hex");
}

export function buildResourceInternalRef(resourceType: string, key: string): string {
  return `${resourceType.toLowerCase()}:${key}`;
}
