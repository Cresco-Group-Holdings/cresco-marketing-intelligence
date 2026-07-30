import { createHash } from "crypto";

export type CapiConsentState = "GRANTED" | "DENIED" | "UNKNOWN";

export type CapiEventInput = {
  eventName: string;
  eventTime: Date;
  browserEventId?: string;
  consentState: CapiConsentState;
  email?: string;
  phone?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
};

export function buildCapiEventId(input: { eventName: string; browserEventId?: string; eventTime: Date }): string {
  const seed = `${input.eventName}:${input.browserEventId ?? ""}:${input.eventTime.toISOString()}`;
  return createHash("sha256").update(seed).digest("hex");
}

export function hashForMeta(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export function buildCapiPayload(input: CapiEventInput, eventId: string): Record<string, unknown> | null {
  if (input.consentState !== "GRANTED") return null;

  const userData: Record<string, string> = {};
  if (input.email) userData.em = hashForMeta(input.email);
  if (input.phone) userData.ph = hashForMeta(input.phone.replace(/\D/g, ""));
  if (input.clientIpAddress) userData.client_ip_address = input.clientIpAddress;
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;

  return {
    event_name: input.eventName,
    event_time: Math.floor(input.eventTime.getTime() / 1000),
    event_id: eventId,
    action_source: "website",
    user_data: userData,
  };
}

export function shouldSkipCapi(consentState: CapiConsentState): boolean {
  return consentState !== "GRANTED";
}
