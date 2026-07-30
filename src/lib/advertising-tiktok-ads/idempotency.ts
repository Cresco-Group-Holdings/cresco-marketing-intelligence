import { createHash } from "crypto";

export function buildLaunchIdempotencyKey(planId: string, planHash: string, version: number): string {
  return createHash("sha256").update(`tiktok:${planId}:${planHash}:${version}`).digest("hex");
}
