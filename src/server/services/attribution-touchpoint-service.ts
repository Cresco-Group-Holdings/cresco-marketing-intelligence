import type {
  AttributionTouchpointSource,
  MarketingDataProvider,
  MarketingSession,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { parseClickIds, extractClickIdFromUrl } from "@/lib/attribution/click-ids";
import { classifyChannel } from "@/lib/warehouse/channel-classification";
import { isEventAllowedByConsent, parseConsentState } from "@/lib/tracking/consent";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

type TouchpointDraft = {
  touchpointSource: AttributionTouchpointSource;
  identityId?: string | null;
  marketingSessionId?: string | null;
  marketingEventId?: string | null;
  marketingCampaignId?: string | null;
  provider?: MarketingDataProvider | null;
  channel?: string | null;
  campaign?: string | null;
  contentKey?: string | null;
  occurredAt: Date;
  sessionKey?: string | null;
  landingPage?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  clickId?: string | null;
  clickIdProvider?: string | null;
  consentState?: unknown;
  evidenceStrength?: number | null;
  providerMetadata?: unknown;
};

function sessionToTouchpointSource(session: MarketingSession): AttributionTouchpointSource {
  const classification = classifyChannel({
    utmSource: session.utmSource,
    utmMedium: session.utmMedium,
    utmCampaign: session.utmCampaign,
    referrer: session.referrer,
    provider: session.provider,
  });

  if (classification.channel === "DIRECT") return "DIRECT_VISIT";
  if (classification.channel === "ORGANIC_SEARCH") return "ORGANIC_SEARCH";
  if (classification.channel === "EMAIL") return "EMAIL_CLICK";
  if (classification.channel === "PAID_SEARCH" || classification.channel === "PAID_SOCIAL" || classification.channel === "DISPLAY") {
    return "PAID_AD_CLICK";
  }
  if (classification.channel === "ORGANIC_SOCIAL") return "SOCIAL_POST_CLICK";
  if (classification.channel === "REFERRAL") return "REFERRAL";
  return "WEBSITE_SESSION";
}

function extractClickIdFromSession(session: MarketingSession) {
  const metadata = session.providerMetadata as Record<string, unknown> | null;
  const landingPage = session.landingPage ?? "";
  const fromUrl = landingPage ? extractClickIdFromUrl(landingPage) : null;
  if (fromUrl) return fromUrl;

  if (metadata && typeof metadata === "object") {
    const params: Record<string, string | undefined> = {};
    for (const key of ["gclid", "fbclid", "ttclid", "li_fat_id", "cresco_cid"]) {
      if (typeof metadata[key] === "string") params[key] = metadata[key];
    }
    return parseClickIds(params);
  }
  return null;
}

export const attributionTouchpointService = {
  sessionToDraft(session: MarketingSession, identityId?: string | null): TouchpointDraft {
    const classification = classifyChannel({
      utmSource: session.utmSource,
      utmMedium: session.utmMedium,
      utmCampaign: session.utmCampaign,
      referrer: session.referrer,
      provider: session.provider,
    });
    const clickId = extractClickIdFromSession(session);

    return {
      touchpointSource: sessionToTouchpointSource(session),
      identityId,
      marketingSessionId: session.id,
      provider: session.provider,
      channel: classification.channel,
      campaign: session.utmCampaign ?? session.campaign,
      contentKey: session.utmContent,
      occurredAt: session.startedAt,
      sessionKey: session.providerSessionId,
      landingPage: session.landingPage,
      utmSource: session.utmSource,
      utmMedium: session.utmMedium,
      utmCampaign: session.utmCampaign,
      utmTerm: session.utmTerm,
      utmContent: session.utmContent,
      clickId: clickId?.clickId,
      clickIdProvider: clickId?.provider,
      consentState: session.consentState,
      evidenceStrength: classification.confidence,
      providerMetadata: session.providerMetadata,
    };
  },

  async extractTouchpointsForIdentity(
    brandId: string,
    organisationId: string,
    identityId: string,
    from: Date,
    to: Date,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);

    const events = await prisma.marketingEvent.findMany({
      where: {
        brandId,
        organisationId,
        identityId,
        occurredAt: { gte: from, lte: to },
      },
      include: { session: true },
      orderBy: { occurredAt: "asc" },
    });

    const sessionIds = new Set<string>();
    const drafts: TouchpointDraft[] = [];

    for (const event of events) {
      if (event.session && !sessionIds.has(event.session.id)) {
        sessionIds.add(event.session.id);
        const consent = parseConsentState(event.session.consentState);
        if (!isEventAllowedByConsent("page_view", consent, false)) continue;
        drafts.push(this.sessionToDraft(event.session, identityId));
      }

      if (event.eventName === "demo_booking" || event.eventName === "demo_scheduled") {
        drafts.push({
          touchpointSource: "DEMO_BOOKING",
          identityId,
          marketingEventId: event.id,
          provider: event.provider,
          occurredAt: event.occurredAt,
          evidenceStrength: 0.9,
        });
      }

      if (event.eventName === "crm_activity") {
        drafts.push({
          touchpointSource: "CRM_ACTIVITY",
          identityId,
          marketingEventId: event.id,
          provider: event.provider,
          occurredAt: event.occurredAt,
          evidenceStrength: 0.85,
        });
      }
    }

    const sessions = await prisma.marketingSession.findMany({
      where: {
        brandId,
        organisationId,
        startedAt: { gte: from, lte: to },
        events: { some: { identityId } },
      },
      orderBy: { startedAt: "asc" },
    });

    for (const session of sessions) {
      if (sessionIds.has(session.id)) continue;
      const consent = parseConsentState(session.consentState);
      if (!isEventAllowedByConsent("page_view", consent, false)) continue;
      drafts.push(this.sessionToDraft(session, identityId));
    }

    return drafts.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  },

  async persistTouchpoints(
    brandId: string,
    organisationId: string,
    projectId: string,
    journeyId: string,
    drafts: TouchpointDraft[],
  ) {
    const created = [];
    for (let index = 0; index < drafts.length; index++) {
      const draft = drafts[index]!;
      const touchpoint = await prisma.attributionTouchpoint.create({
        data: {
          organisationId,
          projectId,
          brandId,
          attributionJourneyId: journeyId,
          touchpointSource: draft.touchpointSource,
          identityId: draft.identityId,
          marketingSessionId: draft.marketingSessionId,
          marketingEventId: draft.marketingEventId,
          marketingCampaignId: draft.marketingCampaignId,
          provider: draft.provider ?? undefined,
          channel: draft.channel,
          campaign: draft.campaign,
          contentKey: draft.contentKey,
          occurredAt: draft.occurredAt,
          sessionKey: draft.sessionKey,
          landingPage: draft.landingPage,
          utmSource: draft.utmSource,
          utmMedium: draft.utmMedium,
          utmCampaign: draft.utmCampaign,
          utmTerm: draft.utmTerm,
          utmContent: draft.utmContent,
          clickId: draft.clickId,
          clickIdProvider: draft.clickIdProvider,
          consentState: draft.consentState as object | undefined,
          evidenceStrength: draft.evidenceStrength,
          position: index + 1,
          providerMetadata: draft.providerMetadata as object | undefined,
        },
      });
      created.push(touchpoint);
    }
    return created;
  },
};
