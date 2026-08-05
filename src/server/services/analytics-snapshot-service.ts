import { prisma } from "@/lib/database/prisma";
import { normaliseDateRange } from "@/lib/analytics-core/date-boundaries";
import { computeAllDerivedMetrics } from "@/lib/analytics-core/metric-engine";
import { AppError } from "@/lib/errors";
import { assertOrganisationScope, type TenantContext } from "@/lib/tenancy/context";
import type { AnalyticsSnapshotCreateInput } from "@/lib/validation/analytics-core";
import { analyticsCoreService } from "@/server/services/analytics-core-service";

function workspaceIdFor(organisationId: string) {
  return organisationId;
}

export const analyticsSnapshotService = {
  async createSnapshot(
    organisationId: string,
    input: AnalyticsSnapshotCreateInput,
    context: TenantContext,
    actorUserId: string,
  ) {
    assertOrganisationScope(organisationId, context);
    const range = normaliseDateRange({ from: input.periodFrom, to: input.periodTo });
    const { totals, currencies } = await analyticsCoreService.aggregateMetrics(
      organisationId,
      {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        projectId: input.projectId,
        brandId: input.brandId,
        campaignId: input.campaignId,
      },
      context,
    );

    const derived = computeAllDerivedMetrics(totals);
    const derivedPayload = Object.fromEntries(
      Object.entries(derived).map(([key, result]) => [key, result.value ? Number(result.value.toString()) : null]),
    );

    const snapshot = await prisma.analyticsSnapshot.create({
      data: {
        organisationId,
        workspaceId: workspaceIdFor(organisationId),
        projectId: input.projectId,
        brandId: input.brandId,
        campaignId: input.campaignId,
        name: input.name,
        status: "FINALIZED",
        periodFrom: range.from,
        periodTo: range.to,
        createdByUserId: actorUserId,
        payload: {
          baseMetrics: totals,
          currencies,
          derivedMetrics: derivedPayload,
          capturedAt: new Date().toISOString(),
        },
      },
    });

    return {
      id: snapshot.id,
      name: snapshot.name,
      status: snapshot.status,
      periodFrom: snapshot.periodFrom.toISOString(),
      periodTo: snapshot.periodTo.toISOString(),
      payload: snapshot.payload,
      createdAt: snapshot.createdAt.toISOString(),
    };
  },

  async listSnapshots(organisationId: string, context: TenantContext, campaignId?: string) {
    assertOrganisationScope(organisationId, context);
    const snapshots = await prisma.analyticsSnapshot.findMany({
      where: {
        organisationId,
        ...(campaignId ? { campaignId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return snapshots.map((snapshot) => ({
      id: snapshot.id,
      name: snapshot.name,
      status: snapshot.status,
      periodFrom: snapshot.periodFrom.toISOString(),
      periodTo: snapshot.periodTo.toISOString(),
      campaignId: snapshot.campaignId,
      createdAt: snapshot.createdAt.toISOString(),
    }));
  },

  async getSnapshot(organisationId: string, snapshotId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    const snapshot = await prisma.analyticsSnapshot.findFirst({
      where: { id: snapshotId, organisationId },
    });
    if (!snapshot) throw new AppError("NOT_FOUND", "Analytics snapshot not found.");
    return {
      id: snapshot.id,
      name: snapshot.name,
      status: snapshot.status,
      periodFrom: snapshot.periodFrom.toISOString(),
      periodTo: snapshot.periodTo.toISOString(),
      payload: snapshot.payload,
      createdAt: snapshot.createdAt.toISOString(),
    };
  },
};
