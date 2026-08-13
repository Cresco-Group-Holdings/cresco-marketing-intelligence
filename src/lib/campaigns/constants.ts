import type { CampaignStatus } from "@prisma/client";

export const DEFAULT_CAMPAIGN_TIMEZONE = "UTC";

export const CAMPAIGN_STATUS_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ["PLANNED", "CANCELLED", "ARCHIVED"],
  PLANNED: ["READY", "DRAFT", "CANCELLED", "ARCHIVED"],
  READY: ["ACTIVE", "PLANNED", "CANCELLED", "ARCHIVED"],
  ACTIVE: ["PAUSED", "COMPLETED", "CANCELLED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "COMPLETED", "CANCELLED", "ARCHIVED"],
  COMPLETED: ["PLANNED", "ARCHIVED"],
  CANCELLED: ["PLANNED", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

const COMMON_ISO_CURRENCY_CODES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "NZD",
  "CHF",
  "JPY",
  "CNY",
  "INR",
  "SGD",
  "HKD",
  "SEK",
  "NOK",
  "DKK",
  "ZAR",
  "BRL",
  "MXN",
] as const;

export function isIsoCurrencyCode(code: string): boolean {
  const normalised = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalised)) return false;
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: normalised }).format(1);
    return true;
  } catch {
    return false;
  }
}

export function listIsoCurrencyCodes(): string[] {
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      return Intl.supportedValuesOf("currency").sort();
    } catch {
      // fall through
    }
  }
  return [...COMMON_ISO_CURRENCY_CODES];
}
