import type { EmailMessageCategory } from "@prisma/client";
import { isMarketingCategory } from "@/lib/email/suppression";

export function requiresMarketingConsent(category: EmailMessageCategory): boolean {
  return isMarketingCategory(category);
}

export function checkConsentEligibility(
  category: EmailMessageCategory,
  consent: { marketing: boolean; transactional: boolean },
): { eligible: boolean; reason?: string } {
  if (requiresMarketingConsent(category) && !consent.marketing) {
    return { eligible: false, reason: "Marketing consent not granted." };
  }
  if (!consent.transactional && category === "ESSENTIAL_TRANSACTIONAL") {
    return { eligible: false, reason: "Transactional consent required." };
  }
  return { eligible: true };
}
