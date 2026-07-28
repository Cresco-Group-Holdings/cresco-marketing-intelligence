import { createHash, randomBytes } from "node:crypto";
import { CONNECTOR_OAUTH_STATE_TTL_MS } from "@/lib/connectors/constants";

export function generateOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function generatePkceVerifier(): string {
  return randomBytes(48).toString("base64url");
}

export function generatePkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function getOAuthStateExpiry(): Date {
  return new Date(Date.now() + CONNECTOR_OAUTH_STATE_TTL_MS);
}

export function scopesSatisfyRequirement(granted: string[], required: string[]): boolean {
  const grantedSet = new Set(granted);
  return required.every((scope) => grantedSet.has(scope));
}

export function inspectGrantedScopes(granted: string[], required: string[], optional: string[]) {
  const missingRequired = required.filter((scope) => !granted.includes(scope));
  const grantedOptional = optional.filter((scope) => granted.includes(scope));
  return {
    missingRequired,
    grantedOptional,
    isSufficient: missingRequired.length === 0,
  };
}
