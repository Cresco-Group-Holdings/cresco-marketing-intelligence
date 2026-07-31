import { prisma } from "@/lib/database/prisma";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

const RECONCILIATION_CAUSES = [
  "Consent and CMP differences may block GA4 while first-party tracking remains active.",
  "Ad blockers and browser privacy tools often block GA4 scripts.",
  "Timezone boundaries differ between GA4 property settings and Cresco tracking properties.",
  "Identity resolution rules differ (GA4 client ID vs Cresco anonymous/user linking).",
  "GA4 may process events up to 72 hours late; first-party events are recorded immediately.",
  "Bot filtering rules differ between GA4 and Cresco quarantine signals.",
  "Metric definitions differ (e.g. screenPageViews vs page_view, sessions vs session_start).",
] as const;

export const ga4ReconciliationService = {
  async compareSources(
    brandId: string,
    organisationId: string,
    from: Date,
    to: Date,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);

    const [ga4Sessions, firstPartySessions, ga4Pageviews, firstPartyPageviews] =
      await Promise.all([
        prisma.marketingMetricObservation.aggregate({
          where: {
            brandId,
            organisationId,
            provider: "GA4",
            metricKey: "sessions",
            observedAt: { gte: from, lte: to },
          },
          _sum: { metricValue: true },
        }),
        prisma.marketingMetricObservation.aggregate({
          where: {
            brandId,
            organisationId,
            provider: "FIRST_PARTY",
            metricKey: "sessions",
            observedAt: { gte: from, lte: to },
          },
          _sum: { metricValue: true },
        }),
        prisma.marketingMetricObservation.aggregate({
          where: {
            brandId,
            organisationId,
            provider: "GA4",
            metricKey: "pageviews",
            observedAt: { gte: from, lte: to },
          },
          _sum: { metricValue: true },
        }),
        prisma.marketingMetricObservation.aggregate({
          where: {
            brandId,
            organisationId,
            provider: "FIRST_PARTY",
            metricKey: "pageviews",
            observedAt: { gte: from, lte: to },
          },
          _sum: { metricValue: true },
        }),
      ]);

    const ga4SessionTotal = Number(ga4Sessions._sum.metricValue ?? 0);
    const firstPartySessionTotal = Number(firstPartySessions._sum.metricValue ?? 0);
    const ga4PageviewTotal = Number(ga4Pageviews._sum.metricValue ?? 0);
    const firstPartyPageviewTotal = Number(firstPartyPageviews._sum.metricValue ?? 0);

    const sessionDelta = ga4SessionTotal - firstPartySessionTotal;
    const pageviewDelta = ga4PageviewTotal - firstPartyPageviewTotal;

    const warnings: string[] = [];
    if (ga4SessionTotal > 0 && firstPartySessionTotal > 0) {
      const pct = Math.abs(sessionDelta) / Math.max(ga4SessionTotal, firstPartySessionTotal);
      if (pct > 0.2) {
        warnings.push(
          `Sessions differ by ${Math.round(pct * 100)}% between GA4 and first-party tracking.`,
        );
      }
    }
    if (ga4PageviewTotal > 0 && firstPartyPageviewTotal > 0) {
      const pct = Math.abs(pageviewDelta) / Math.max(ga4PageviewTotal, firstPartyPageviewTotal);
      if (pct > 0.2) {
        warnings.push(
          `Page views differ by ${Math.round(pct * 100)}% between GA4 and first-party tracking.`,
        );
      }
    }
    if (ga4SessionTotal === 0 && firstPartySessionTotal > 0) {
      warnings.push("GA4 has no session data for this period. Check sync status and property selection.");
    }
    if (firstPartySessionTotal === 0 && ga4SessionTotal > 0) {
      warnings.push("First-party tracking has no session data for this period.");
    }

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      comparison: {
        sessions: {
          ga4: ga4SessionTotal,
          firstParty: firstPartySessionTotal,
          delta: sessionDelta,
        },
        pageviews: {
          ga4: ga4PageviewTotal,
          firstParty: firstPartyPageviewTotal,
          delta: pageviewDelta,
        },
      },
      warnings,
      possibleCauses: RECONCILIATION_CAUSES,
      disclaimer:
        "Neither GA4 nor first-party tracking is presented as universally correct. Differences are expected and should be interpreted in context.",
    };
  },
};
