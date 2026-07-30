export type SessionContext = {
  sessionId: string;
  anonymousId: string;
  startedAt: Date;
  lastActivityAt: Date;
  landingPage?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
};

export function shouldStartNewSession(input: {
  lastActivityAt: Date;
  now: Date;
  timeoutMinutes: number;
  previousCampaign?: string | null;
  nextCampaign?: string | null;
  campaignChangeStartsSession?: boolean;
}): boolean {
  const idleMs = input.now.getTime() - input.lastActivityAt.getTime();
  if (idleMs > input.timeoutMinutes * 60_000) {
    return true;
  }

  if (
    input.campaignChangeStartsSession &&
    input.previousCampaign &&
    input.nextCampaign &&
    input.previousCampaign !== input.nextCampaign
  ) {
    return true;
  }

  return false;
}

export function deviceCategoryFromUserAgent(userAgent: string | null | undefined): string {
  const ua = userAgent?.toLowerCase() ?? "";
  if (/mobile|iphone|android/.test(ua)) return "mobile";
  if (/ipad|tablet/.test(ua)) return "tablet";
  return "desktop";
}
