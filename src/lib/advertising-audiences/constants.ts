import type { AdvertisingAudienceStatus } from "@prisma/client";

export const AUDIENCE_STATUS_TRANSITIONS: Record<AdvertisingAudienceStatus, AdvertisingAudienceStatus[]> = {
  DRAFT: ["IN_REVIEW", "ARCHIVED"],
  IN_REVIEW: ["APPROVED", "CHANGES_REQUESTED", "ARCHIVED"],
  CHANGES_REQUESTED: ["DRAFT", "IN_REVIEW", "ARCHIVED"],
  APPROVED: ["ARCHIVED"],
  ARCHIVED: [],
};

export const RETARGETING_WINDOWS = [1, 7, 14, 30, 60, 90, 180] as const;
export const MAX_CUSTOM_RETARGETING_DAYS = 180;

export const MIN_AUDIENCE_SIZE_DEFAULT = 100;

export const PROVIDERS = ["GOOGLE_ADS", "META", "LINKEDIN", "TIKTOK"] as const;

export const HUMANBRIDGE_SAFEGUARD_NOTE =
  "HumanBridge-related audiences require additional consent and purpose-limitation safeguards.";
