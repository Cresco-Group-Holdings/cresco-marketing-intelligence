import {
  BLOCKED_PROPERTY_KEYS,
  STANDARD_TRACKING_EVENTS,
  TRACKING_MAX_EVENT_NAME_LENGTH,
  TRACKING_MAX_EVENT_PROPERTIES,
  TRACKING_MAX_PROPERTY_KEY_LENGTH,
  TRACKING_MAX_PROPERTY_VALUE_LENGTH,
  TRACKING_MAX_URL_LENGTH,
} from "@/lib/tracking/constants";

const CUSTOM_EVENT_PATTERN = /^[a-z][a-z0-9_]{1,48}$/;

export function isValidEventName(eventName: string): boolean {
  if (eventName.length > TRACKING_MAX_EVENT_NAME_LENGTH) return false;
  if ((STANDARD_TRACKING_EVENTS as readonly string[]).includes(eventName)) return true;
  if (eventName === "custom_event") return true;
  return CUSTOM_EVENT_PATTERN.test(eventName);
}

export function sanitizeEventProperties(
  properties: Record<string, unknown> | undefined,
): Record<string, string | number | boolean | null> {
  if (!properties) return {};

  const sanitized: Record<string, string | number | boolean | null> = {};
  const entries = Object.entries(properties).slice(0, TRACKING_MAX_EVENT_PROPERTIES);

  for (const [key, value] of entries) {
    const normalisedKey = key.trim().toLowerCase();
    if (!normalisedKey || BLOCKED_PROPERTY_KEYS.has(normalisedKey)) continue;
    if (normalisedKey.length > TRACKING_MAX_PROPERTY_KEY_LENGTH) continue;

    if (typeof value === "string") {
      sanitized[normalisedKey] = value.slice(0, TRACKING_MAX_PROPERTY_VALUE_LENGTH);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      sanitized[normalisedKey] = value;
    } else if (typeof value === "boolean") {
      sanitized[normalisedKey] = value;
    } else if (value === null) {
      sanitized[normalisedKey] = null;
    }
  }

  return sanitized;
}

export function sanitiseUrl(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, TRACKING_MAX_URL_LENGTH);
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("/")) {
    return undefined;
  }
  return trimmed;
}

export function normaliseOrigin(origin: string | null | undefined): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export function hostnameFromOrigin(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}
