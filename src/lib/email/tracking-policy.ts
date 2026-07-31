export type TrackingPolicyInput = {
  openTrackingEnabled: boolean;
  clickTrackingEnabled: boolean;
  requireConsent: boolean;
  restrictedRegions: string[];
  recipientRegion?: string;
  consentGranted?: boolean;
};

export function canTrackOpens(policy: TrackingPolicyInput): boolean {
  if (!policy.openTrackingEnabled) return false;
  if (policy.requireConsent && !policy.consentGranted) return false;
  if (policy.recipientRegion && policy.restrictedRegions.includes(policy.recipientRegion)) return false;
  return true;
}

export function canTrackClicks(policy: TrackingPolicyInput): boolean {
  if (!policy.clickTrackingEnabled) return false;
  if (policy.requireConsent && !policy.consentGranted) return false;
  if (policy.recipientRegion && policy.restrictedRegions.includes(policy.recipientRegion)) return false;
  return true;
}

export const OPEN_TRACKING_DISCLAIMER =
  "Open rates are indicative only and may be affected by privacy features, image blocking, and prefetching.";
