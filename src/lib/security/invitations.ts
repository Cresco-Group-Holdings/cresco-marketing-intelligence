import { createHash, randomBytes } from "node:crypto";

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateInvitationToken(): string {
  return randomBytes(32).toString("hex");
}

export function isInvitationExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() <= Date.now();
}
