import type { EmailDeliveryEventType } from "@prisma/client";

const EVENT_TYPE_MAP: Record<string, EmailDeliveryEventType> = {
  ACCEPTED: "ACCEPTED",
  QUEUED: "QUEUED",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  DEFERRED: "DEFERRED",
  BOUNCE: "BOUNCED",
  BOUNCED: "BOUNCED",
  COMPLAINT: "COMPLAINED",
  COMPLAINED: "COMPLAINED",
  OPEN: "OPENED",
  OPENED: "OPENED",
  CLICK: "CLICKED",
  CLICKED: "CLICKED",
  UNSUBSCRIBE: "UNSUBSCRIBED",
  UNSUBSCRIBED: "UNSUBSCRIBED",
  REJECT: "REJECTED",
  REJECTED: "REJECTED",
  FAIL: "FAILED",
  FAILED: "FAILED",
};

export function normaliseEventType(raw: string): EmailDeliveryEventType {
  return EVENT_TYPE_MAP[raw.toUpperCase()] ?? "FAILED";
}

export function buildWebhookIdempotencyKey(
  providerEventId: string | undefined,
  eventType: string,
  emailAddress: string | undefined,
  occurredAt: Date,
): string {
  return providerEventId ?? `${eventType}:${emailAddress ?? "unknown"}:${occurredAt.getTime()}`;
}

export function isReplay(eventOccurredAt: Date, lastProcessedAt: Date | null): boolean {
  if (!lastProcessedAt) return false;
  return eventOccurredAt <= lastProcessedAt;
}
