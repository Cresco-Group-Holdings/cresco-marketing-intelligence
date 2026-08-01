import type { VerifiedDomainInfo } from "@/lib/providers/email-types";
import type { ResendDomainRecord, ResendWebhookPayload } from "@/server/providers/resend/resend-types";

export type NormalizedProviderEmailEventType =
  | "EMAIL_SENT"
  | "EMAIL_DELIVERED"
  | "EMAIL_DELAYED"
  | "EMAIL_BOUNCED"
  | "EMAIL_COMPLAINED"
  | "EMAIL_FAILED"
  | "EMAIL_OPENED"
  | "EMAIL_CLICKED"
  | "EMAIL_SUPPRESSED"
  | "DOMAIN_VERIFIED"
  | "DOMAIN_FAILED"
  | "UNKNOWN";

export type NormalizedProviderEmailEvent = {
  providerEventId: string;
  providerMessageId?: string;
  connectionId?: string;
  eventType: NormalizedProviderEmailEventType;
  occurredAt: string;
  recipient?: string;
  campaignId?: string;
  messageReference?: string;
  safeMetadata: Record<string, unknown>;
};

const EVENT_TYPE_MAP: Record<string, NormalizedProviderEmailEventType> = {
  "email.sent": "EMAIL_SENT",
  "email.delivered": "EMAIL_DELIVERED",
  "email.delivery_delayed": "EMAIL_DELAYED",
  "email.bounced": "EMAIL_BOUNCED",
  "email.complained": "EMAIL_COMPLAINED",
  "email.failed": "EMAIL_FAILED",
  "email.opened": "EMAIL_OPENED",
  "email.clicked": "EMAIL_CLICKED",
  "email.suppressed": "EMAIL_SUPPRESSED",
  "domain.created": "DOMAIN_VERIFIED",
  "domain.updated": "DOMAIN_VERIFIED",
  "domain.deleted": "DOMAIN_FAILED",
  "suppression.added": "EMAIL_SUPPRESSED",
};

export function mapResendDomain(record: ResendDomainRecord): VerifiedDomainInfo {
  const spf = record.records?.find((r) => r.record === "SPF" || r.type === "TXT");
  const dkim = record.records?.find((r) => r.record === "DKIM" || r.type === "CNAME");
  const verified = record.status === "verified";

  return {
    id: record.id,
    name: record.name,
    status: record.status,
    region: record.region,
    sendingEligible: verified,
    spfStatus: spf?.status,
    dkimStatus: dkim?.status,
    verifiedAt: verified ? record.created_at : undefined,
    lastCheckedAt: new Date().toISOString(),
  };
}

export function normalizeResendWebhookEvent(
  payload: ResendWebhookPayload,
  providerEventId: string,
): NormalizedProviderEmailEvent {
  const eventType = EVENT_TYPE_MAP[payload.type] ?? "UNKNOWN";
  const data = payload.data ?? {};

  const providerMessageId =
    typeof data.email_id === "string"
      ? data.email_id
      : typeof data.emailId === "string"
        ? data.emailId
        : undefined;

  const recipient = Array.isArray(data.to)
    ? String(data.to[0] ?? "")
    : typeof data.to === "string"
      ? data.to
      : undefined;

  const safeMetadata: Record<string, unknown> = {
    providerEventType: payload.type,
    broadcastId: typeof data.broadcast_id === "string" ? data.broadcast_id : undefined,
    templateId: typeof data.template_id === "string" ? data.template_id : undefined,
    bounceType:
      data.bounce && typeof data.bounce === "object" && data.bounce !== null && "type" in data.bounce
        ? (data.bounce as { type?: string }).type
        : undefined,
  };

  return {
    providerEventId,
    providerMessageId,
    eventType,
    occurredAt: payload.created_at ?? new Date().toISOString(),
    recipient: recipient || undefined,
    campaignId: typeof data.broadcast_id === "string" ? data.broadcast_id : undefined,
    messageReference: providerMessageId,
    safeMetadata,
  };
}

/** Lifecycle precedence: higher index = terminal / should not be overwritten by lower. */
export const EMAIL_STATUS_PRECEDENCE: Record<string, number> = {
  DRAFT: 0,
  APPROVED: 1,
  QUEUED: 2,
  SUBMITTING: 3,
  ACCEPTED: 4,
  SENT: 5,
  DELIVERED: 6,
  DELAYED: 5,
  OPENED: 7,
  CLICKED: 8,
  FAILED: 10,
  BOUNCED: 10,
  COMPLAINED: 10,
  SUPPRESSED: 10,
  REJECTED: 10,
  CANCELLED: 10,
  UNKNOWN: 0,
};

export function shouldAdvanceEmailStatus(current: string, incoming: string): boolean {
  const currentRank = EMAIL_STATUS_PRECEDENCE[current] ?? 0;
  const incomingRank = EMAIL_STATUS_PRECEDENCE[incoming] ?? 0;
  return incomingRank >= currentRank;
}

export function mapNormalizedEventToEmailStatus(eventType: NormalizedProviderEmailEventType): string {
  switch (eventType) {
    case "EMAIL_SENT":
      return "SENT";
    case "EMAIL_DELIVERED":
      return "DELIVERED";
    case "EMAIL_DELAYED":
      return "DELAYED";
    case "EMAIL_BOUNCED":
      return "BOUNCED";
    case "EMAIL_COMPLAINED":
      return "COMPLAINED";
    case "EMAIL_FAILED":
      return "FAILED";
    case "EMAIL_OPENED":
      return "OPENED";
    case "EMAIL_CLICKED":
      return "CLICKED";
    case "EMAIL_SUPPRESSED":
      return "SUPPRESSED";
    default:
      return "UNKNOWN";
  }
}
