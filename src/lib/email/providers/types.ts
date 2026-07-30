import type { EmailDnsRecordStatus, EmailProviderType } from "@prisma/client";

export type NormalisedDeliveryEvent = {
  eventType: string;
  providerEventId?: string;
  providerMessageId?: string;
  emailAddress?: string;
  occurredAt: Date;
  bounceType?: "HARD" | "SOFT";
  reason?: string;
  metadata?: Record<string, unknown>;
};

export type DomainVerificationResult = {
  spfStatus: EmailDnsRecordStatus;
  dkimStatus: EmailDnsRecordStatus;
  dmarcStatus: EmailDnsRecordStatus;
  providerVerified: boolean;
  instructions: Array<{ type: string; name: string; value: string }>;
};

export type SendResult = {
  providerMessageId: string;
  recipientIds: Record<string, string>;
};

export interface EmailProviderAdapter {
  readonly providerType: EmailProviderType;
  verifyDomain(domain: string, config: Record<string, unknown>): Promise<DomainVerificationResult>;
  send(input: {
    from: string;
    replyTo?: string;
    subject: string;
    html?: string;
    text?: string;
    recipients: Array<{ email: string; name?: string; variables?: Record<string, string> }>;
    idempotencyKey?: string;
  }): Promise<SendResult>;
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
  parseWebhookEvents(payload: unknown): NormalisedDeliveryEvent[];
}
