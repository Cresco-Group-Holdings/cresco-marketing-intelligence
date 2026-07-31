import { createHmac, timingSafeEqual } from "crypto";
import type { EmailDnsRecordStatus, EmailProviderType } from "@prisma/client";
import type { DomainVerificationResult, EmailProviderAdapter, NormalisedDeliveryEvent } from "@/lib/email/providers/types";

type ProviderConfig = {
  spfRecord: string;
  dkimSelector: string;
  webhookHeader: string;
};

export function baseAdapter(providerType: EmailProviderType, config: ProviderConfig): EmailProviderAdapter {
  return {
    providerType,
    async verifyDomain(domain: string): Promise<DomainVerificationResult> {
      const instructions = [
        { type: "SPF", name: domain, value: `v=spf1 ${config.spfRecord} ~all` },
        { type: "DKIM", name: `${config.dkimSelector}._domainkey.${domain}`, value: "[provider-supplied]" },
        { type: "DMARC", name: `_dmarc.${domain}`, value: "v=DMARC1; p=none; rua=mailto:dmarc@" + domain },
      ];
      return {
        spfStatus: "PENDING" as EmailDnsRecordStatus,
        dkimStatus: "PENDING" as EmailDnsRecordStatus,
        dmarcStatus: "PENDING" as EmailDnsRecordStatus,
        providerVerified: false,
        instructions,
      };
    },
    async send(input) {
      const providerMessageId = `${providerType.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const recipientIds: Record<string, string> = {};
      for (const r of input.recipients) {
        recipientIds[r.email] = `${providerMessageId}_${r.email}`;
      }
      return { providerMessageId, recipientIds };
    },
    verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
      if (!signature || !secret) return false;
      const expected = createHmac("sha256", secret).update(payload).digest("hex");
      try {
        return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      } catch {
        return false;
      }
    },
    parseWebhookEvents(payload: unknown): NormalisedDeliveryEvent[] {
      const events = Array.isArray(payload) ? payload : [payload];
      return events
        .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
        .map((e) => ({
          eventType: String(e.event ?? e.type ?? "UNKNOWN").toUpperCase(),
          providerEventId: e.id ? String(e.id) : undefined,
          providerMessageId: e.message_id ? String(e.message_id) : e.messageId ? String(e.messageId) : undefined,
          emailAddress: e.email ? String(e.email) : e.recipient ? String(e.recipient) : undefined,
          occurredAt: e.timestamp ? new Date(Number(e.timestamp) * 1000) : new Date(),
          bounceType: e.bounce_type === "hard" || e.type === "bounce" && e.severity === "permanent" ? "HARD" as const : undefined,
          reason: e.reason ? String(e.reason) : undefined,
          metadata: { provider: providerType, header: config.webhookHeader },
        }));
    },
  };
}
