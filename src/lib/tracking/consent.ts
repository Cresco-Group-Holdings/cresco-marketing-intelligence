import type { TrackingConsentCategory } from "@prisma/client";
import { ESSENTIAL_TRACKING_EVENTS } from "@/lib/tracking/constants";

export type ConsentState = Partial<Record<TrackingConsentCategory, boolean>>;

export function parseConsentState(value: unknown): ConsentState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const state: ConsentState = {};
  for (const [key, enabled] of Object.entries(value)) {
    if (typeof enabled === "boolean") {
      state[key as TrackingConsentCategory] = enabled;
    }
  }
  return state;
}

export function isEventAllowedByConsent(
  eventName: string,
  consent: ConsentState,
  cookielessMode: boolean,
): boolean {
  if (ESSENTIAL_TRACKING_EVENTS.has(eventName as never)) {
    return true;
  }

  if (cookielessMode) {
    return consent.ANALYTICS === true;
  }

  if (consent.ANALYTICS === false) {
    return false;
  }

  if (
    ["signup_complete", "purchase", "subscription_start", "trial_start"].includes(eventName) &&
    consent.MARKETING === false
  ) {
    return false;
  }

  return true;
}
