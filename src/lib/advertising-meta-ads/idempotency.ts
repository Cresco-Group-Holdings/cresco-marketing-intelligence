import { createHash } from "crypto";

export function buildLaunchIdempotencyKey(planId: string, planHash: string, launchVersion: number): string {
  return createHash("sha256").update(`meta:${planId}:${planHash}:${launchVersion}`).digest("hex");
}
