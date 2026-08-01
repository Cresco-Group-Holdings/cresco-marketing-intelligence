import { createHash, randomBytes } from "node:crypto";

export { generatePkceVerifier, generatePkceChallenge } from "@/lib/connectors/oauth/utils";

export function generateOAuthStateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function digestWebhookPayload(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}
