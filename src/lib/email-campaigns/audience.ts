import { createHash } from "crypto";
import { normaliseEmailAddress } from "@/lib/email/suppression";

export type SegmentMember = {
  emailAddress: string;
  displayName?: string;
  leadId?: string;
  contactId?: string;
  consentMarketing: boolean;
  variables?: Record<string, string>;
};

export type AudienceBreakdown = {
  totalMembers: number;
  consentEligible: number;
  suppressedCount: number;
  invalidCount: number;
  duplicatedCount: number;
  finalSendableCount: number;
  sendable: SegmentMember[];
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function computeAudienceBreakdown(
  members: SegmentMember[],
  suppressedEmails: Set<string>,
): AudienceBreakdown {
  const seen = new Set<string>();
  let consentEligible = 0;
  let suppressedCount = 0;
  let invalidCount = 0;
  let duplicatedCount = 0;
  const sendable: SegmentMember[] = [];

  for (const member of members) {
    const email = normaliseEmailAddress(member.emailAddress);
    if (!isValidEmail(email)) {
      invalidCount++;
      continue;
    }
    if (seen.has(email)) {
      duplicatedCount++;
      continue;
    }
    seen.add(email);

    if (suppressedEmails.has(email)) {
      suppressedCount++;
      continue;
    }
    if (!member.consentMarketing) continue;
    consentEligible++;

    sendable.push({ ...member, emailAddress: email });
  }

  return {
    totalMembers: members.length,
    consentEligible,
    suppressedCount,
    invalidCount,
    duplicatedCount,
    finalSendableCount: sendable.length,
    sendable,
  };
}

export function hashAudienceRules(rules: unknown): string {
  return createHash("sha256").update(JSON.stringify(rules)).digest("hex");
}

export function hashContent(content: {
  subject: string;
  preheader?: string | null;
  htmlBody?: string | null;
  plainTextBody?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
}): string {
  return createHash("sha256")
    .update(JSON.stringify({
      subject: content.subject,
      preheader: content.preheader,
      htmlBody: content.htmlBody,
      plainTextBody: content.plainTextBody,
      ctaText: content.ctaText,
      ctaUrl: content.ctaUrl,
    }))
    .digest("hex");
}
