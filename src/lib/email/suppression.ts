import type { EmailMessageCategory, EmailSuppressionReason } from "@prisma/client";
import { MARKETING_CATEGORIES } from "@/lib/email/constants";

export type SuppressionCheck = {
  emailAddress: string;
  reason?: EmailSuppressionReason;
  suppressed: boolean;
};

export function isMarketingCategory(category: EmailMessageCategory): boolean {
  return (MARKETING_CATEGORIES as readonly string[]).includes(category);
}

export function shouldBlockSend(
  category: EmailMessageCategory,
  suppression: SuppressionCheck | null,
  unsubscribed: boolean,
): { blocked: boolean; reason?: string } {
  if (!suppression?.suppressed && !unsubscribed) return { blocked: false };

  if (isMarketingCategory(category)) {
    return {
      blocked: true,
      reason: suppression?.reason ?? "UNSUBSCRIBE",
    };
  }

  const transactionalAllowed: EmailSuppressionReason[] = ["COMPLAINT", "HARD_BOUNCE", "LEGAL_DELETION", "INVALID_ADDRESS"];
  if (suppression?.reason && transactionalAllowed.includes(suppression.reason)) {
    return { blocked: true, reason: suppression.reason };
  }

  return { blocked: false };
}

export function normaliseEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}
