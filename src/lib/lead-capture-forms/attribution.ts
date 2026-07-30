export type AttributionInput = {
  pageUrl?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  campaignId?: string;
  adClickId?: string;
  socialContentId?: string;
  anonymousId?: string;
  sessionId?: string;
  trackingPropertyId?: string;
};

export function buildAttributionRecord(input: AttributionInput, formVersionId: string) {
  return {
    pageUrl: input.pageUrl?.slice(0, 2048) ?? null,
    referrer: input.referrer?.slice(0, 2048) ?? null,
    utmSource: input.utmSource?.slice(0, 255) ?? null,
    utmMedium: input.utmMedium?.slice(0, 255) ?? null,
    utmCampaign: input.utmCampaign?.slice(0, 255) ?? null,
    utmTerm: input.utmTerm?.slice(0, 255) ?? null,
    utmContent: input.utmContent?.slice(0, 255) ?? null,
    campaignId: input.campaignId?.slice(0, 255) ?? null,
    adClickId: input.adClickId?.slice(0, 255) ?? null,
    socialContentId: input.socialContentId?.slice(0, 255) ?? null,
    anonymousId: input.anonymousId?.slice(0, 255) ?? null,
    sessionId: input.sessionId?.slice(0, 255) ?? null,
    trackingPropertyId: input.trackingPropertyId?.slice(0, 255) ?? null,
    formVersionId,
    capturedAt: new Date(),
  };
}

export function buildIdempotencyKey(formId: string, clientKey: string): string {
  return `${formId}:${clientKey}`;
}
