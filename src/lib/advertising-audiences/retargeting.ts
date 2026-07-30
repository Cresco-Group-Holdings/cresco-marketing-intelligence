import { MAX_CUSTOM_RETARGETING_DAYS, RETARGETING_WINDOWS } from "@/lib/advertising-audiences/constants";

export function isValidRetargetingWindow(days: number): boolean {
  if ((RETARGETING_WINDOWS as readonly number[]).includes(days)) return true;
  return days > 0 && days <= MAX_CUSTOM_RETARGETING_DAYS;
}

export function isRetargetingExpired(lastActivityAt: Date, windowDays: number, now = new Date()): boolean {
  const expiry = new Date(lastActivityAt);
  expiry.setDate(expiry.getDate() + windowDays);
  return now > expiry;
}

export function calculateRetargetingExpiry(lastActivityAt: Date, windowDays: number): Date {
  const expiry = new Date(lastActivityAt);
  expiry.setDate(expiry.getDate() + windowDays);
  return expiry;
}
