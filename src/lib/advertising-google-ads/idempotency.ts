import { createHash } from "crypto";

export function buildLaunchIdempotencyKey(planId: string, planHash: string, launchVersion: number): string {
  return createHash("sha256").update(`${planId}:${planHash}:${launchVersion}`).digest("hex");
}

export function buildResourceInternalRef(launchId: string, resourceType: string, index: number): string {
  return `${launchId}:${resourceType}:${index}`;
}
