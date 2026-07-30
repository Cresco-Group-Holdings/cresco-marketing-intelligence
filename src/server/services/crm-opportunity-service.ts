import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { computeForecast } from "@/lib/crm-pipelines/forecasting";
import { computePipelineHealth } from "@/lib/crm-pipelines/health";
import {
  buildTransitionRecord,
  categoryToStatus,
  validateMarkLost,
  validateMarkWon,
  validateStageTransition,
  type OpportunitySnapshot,
  type PipelineStage,
} from "@/lib/crm-pipelines/transitions";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";
import { recordAuditEvent } from "@/server/services/audit-service";

const opportunityInclude = {
  pipeline: true,
  currentStage: true,
  owner: { select: { id: true, displayName: true } },
  company: true,
  lead: { include: { person: true } },
  values: { orderBy: { createdAt: "desc" as const } },
  contactRoles: { include: { person: true } },
  competitors: true,
  stageHistory: { orderBy: { createdAt: "desc" as const }, take: 20 },
  probabilityHistory: { orderBy: { createdAt: "desc" as const }, take: 10 },
  lossReason: true,
  products: true,
} satisfies Prisma.CrmOpportunityInclude;

function toSnapshot(opp: {
  id: string;
  name: string;
  status: string;
  ownerUserId: string | null;
  companyId: string | null;
  product: string | null;
  plan: string | null;
  expectedCloseDate: Date | null;
  probability: Prisma.Decimal;
  nextAction: string | null;
  stageEnteredAt: Date;
  lastActivityAt: Date;
  currentStageId: string;
  values?: Array<{ amount: Prisma.Decimal; valueType: string }>;
  contactRoles?: Array<{ roleType: string }>;
}): OpportunitySnapshot {
  const expected = opp.values?.find((v) => v.valueType === "EXPECTED");
  const recurring = opp.values?.find((v) => v.valueType === "RECURRING");
  return {
    id: opp.id,
    name: opp.name,
    status: opp.status,
    ownerUserId: opp.ownerUserId,
    companyId: opp.companyId,
    product: opp.product,
    plan: opp.plan,
    expectedCloseDate: opp.expectedCloseDate,
    probability: Number(opp.probability),
    expectedValue: expected ? Number(expected.amount) : undefined,
    recurringValue: recurring ? Number(recurring.amount) : undefined,
    nextAction: opp.nextAction,
    stageEnteredAt: opp.stageEnteredAt,
    lastActivityAt: opp.lastActivityAt,
    currentStageId: opp.currentStageId,
    hasDecisionMaker: opp.contactRoles?.some((r) => r.roleType === "DECISION_MAKER") ?? false,
  };
}

export const crmOpportunityService = {
  async listOpportunities(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    filters?: { pipelineId?: string; ownerUserId?: string; status?: string; stageId?: string },
  ) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.crmOpportunity.findMany({
      where: {
        organisationId,
        brandId,
        archivedAt: null,
        ...(filters?.pipelineId ? { pipelineId: filters.pipelineId } : {}),
        ...(filters?.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
        ...(filters?.status ? { status: filters.status as Prisma.EnumCrmOpportunityStatusFilter["equals"] } : {}),
        ...(filters?.stageId ? { currentStageId: filters.stageId } : {}),
      },
      include: opportunityInclude,
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
  },

  async getOpportunity(opportunityId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const opp = await prisma.crmOpportunity.findFirst({
      where: { id: opportunityId, organisationId, brandId },
      include: opportunityInclude,
    });
    if (!opp) throw new AppError("NOT_FOUND", "Opportunity not found.");
    return opp;
  },

  async createOpportunity(
    brandId: string,
    organisationId: string,
    input: {
      pipelineId: string;
      name: string;
      leadId?: string;
      companyId?: string;
      ownerUserId?: string;
      product?: string;
      plan?: string;
      expectedValue?: number;
      recurringValue?: number;
      currency?: string;
      expectedCloseDate?: string;
      campaign?: string;
      attributionJourneyId?: string;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const pipeline = await prisma.crmPipeline.findFirst({
      where: { id: input.pipelineId, organisationId, brandId },
      include: { versions: { where: { isActive: true }, include: { stages: { where: { isArchived: false }, orderBy: { sortOrder: "asc" } } } } },
    });
    if (!pipeline) throw new AppError("NOT_FOUND", "Pipeline not found.");

    const version = pipeline.versions[0];
    const firstStage = version?.stages.find((s) => s.category !== "WON" && s.category !== "LOST") ?? version?.stages[0];
    if (!version || !firstStage) throw new AppError("VALIDATION_ERROR", "Pipeline has no stages.");

    if (input.leadId) {
      const existing = await prisma.crmOpportunity.findFirst({
        where: { leadId: input.leadId, status: "OPEN", organisationId, brandId },
      });
      if (existing) throw new AppError("VALIDATION_ERROR", "An open opportunity already exists for this lead.");
    }

    return prisma.$transaction(async (tx) => {
      const opp = await tx.crmOpportunity.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          pipelineId: pipeline.id,
          pipelineVersionId: version.id,
          currentStageId: firstStage.id,
          leadId: input.leadId,
          companyId: input.companyId,
          ownerUserId: input.ownerUserId ?? context.userProfileId,
          name: input.name,
          product: input.product,
          plan: input.plan,
          probability: firstStage.probability,
          currency: input.currency ?? "GBP",
          expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : undefined,
          campaign: input.campaign,
          attributionJourneyId: input.attributionJourneyId,
          createdByUserId: context.userProfileId,
        },
        include: opportunityInclude,
      });

      if (input.expectedValue) {
        await tx.crmOpportunityValue.create({
          data: { opportunityId: opp.id, valueType: "EXPECTED", amount: input.expectedValue, currency: input.currency ?? "GBP" },
        });
      }
      if (input.recurringValue) {
        await tx.crmOpportunityValue.create({
          data: { opportunityId: opp.id, valueType: "RECURRING", amount: input.recurringValue, currency: input.currency ?? "GBP", isRecurring: true, recurringPeriod: "MONTHLY" },
        });
      }

      await tx.crmOpportunityStageHistory.create({
        data: {
          opportunityId: opp.id,
          newStageId: firstStage.id,
          newCategory: firstStage.category,
          actorUserId: context.userProfileId,
          source: "CREATE",
          reason: "Opportunity created",
        },
      });

      if (input.leadId) {
        await tx.crmLead.update({
          where: { id: input.leadId },
          data: { status: "OPPORTUNITY_CREATED", lifecycleStage: "OPPORTUNITY", lastActivityAt: new Date() },
        });
        await tx.crmLeadStatusHistory.create({
          data: { leadId: input.leadId, newStatus: "OPPORTUNITY_CREATED", actorUserId: context.userProfileId, source: "OPPORTUNITY_CREATE" },
        });
      }

      return tx.crmOpportunity.findUnique({ where: { id: opp.id }, include: opportunityInclude });
    });
  },

  async moveStage(
    opportunityId: string,
    brandId: string,
    organisationId: string,
    newStageId: string,
    reason: string | undefined,
    context: TenantContext,
  ) {
    const opp = await this.getOpportunity(opportunityId, brandId, organisationId, context);
    const toStage = await prisma.crmPipelineStage.findFirst({ where: { id: newStageId, versionId: opp.pipelineVersionId } });
    if (!toStage) throw new AppError("NOT_FOUND", "Target stage not found.");

    const fromStage: PipelineStage = {
      id: opp.currentStage.id,
      name: opp.currentStage.name,
      sortOrder: opp.currentStage.sortOrder,
      category: opp.currentStage.category,
      probability: Number(opp.currentStage.probability),
      requiredFields: opp.currentStage.requiredFields as string[] | undefined,
      requiresApproval: opp.currentStage.requiresApproval,
      maxDurationDays: opp.currentStage.maxDurationDays ?? undefined,
    };
    const snapshot = toSnapshot(opp);
    const check = validateStageTransition({
      opportunity: snapshot,
      fromStage,
      toStage: {
        id: toStage.id,
        name: toStage.name,
        sortOrder: toStage.sortOrder,
        category: toStage.category,
        probability: Number(toStage.probability),
        requiredFields: toStage.requiredFields as string[] | undefined,
        requiresApproval: toStage.requiresApproval,
        maxDurationDays: toStage.maxDurationDays ?? undefined,
      },
      reason,
      actorUserId: context.userProfileId,
      hasApproval: false,
    });
    if (!check.valid) throw new AppError("VALIDATION_ERROR", check.errors.join(" "));

    return prisma.$transaction(async (tx) => {
      await tx.crmOpportunityStageHistory.create({
        data: {
          opportunityId,
          previousStageId: opp.currentStageId,
          newStageId: toStage.id,
          previousCategory: opp.currentStage.category,
          newCategory: toStage.category,
          actorUserId: context.userProfileId,
          reason,
          source: "MANUAL",
        },
      });
      return tx.crmOpportunity.update({
        where: { id: opportunityId },
        data: {
          currentStageId: toStage.id,
          probability: toStage.probability,
          stageEnteredAt: new Date(),
          lastActivityAt: new Date(),
        },
        include: opportunityInclude,
      });
    });
  },

  async markWon(
    opportunityId: string,
    brandId: string,
    organisationId: string,
    input: { evidenceType: string; evidenceReference: string; notes?: string },
    context: TenantContext,
  ) {
    const check = validateMarkWon(input.evidenceType, input.evidenceReference);
    if (!check.valid) throw new AppError("VALIDATION_ERROR", check.error ?? "Invalid won evidence.");

    const opp = await this.getOpportunity(opportunityId, brandId, organisationId, context);
    if (opp.status !== "OPEN") throw new AppError("VALIDATION_ERROR", "Opportunity is not open.");

    const wonStage = await prisma.crmPipelineStage.findFirst({
      where: { versionId: opp.pipelineVersionId, category: "WON", isArchived: false },
    });

    return prisma.$transaction(async (tx) => {
      if (wonStage) {
        await tx.crmOpportunityStageHistory.create({
          data: {
            opportunityId,
            previousStageId: opp.currentStageId,
            newStageId: wonStage.id,
            previousCategory: opp.currentStage.category,
            newCategory: "WON",
            actorUserId: context.userProfileId,
            reason: input.notes ?? `Won: ${input.evidenceType}`,
            source: "MARK_WON",
          },
        });
      }

      const updated = await tx.crmOpportunity.update({
        where: { id: opportunityId },
        data: {
          status: "WON",
          wonEvidenceType: input.evidenceType as Prisma.CrmOpportunityUpdateInput["wonEvidenceType"],
          wonEvidenceReference: input.evidenceReference,
          probability: 100,
          currentStageId: wonStage?.id ?? opp.currentStageId,
          lastActivityAt: new Date(),
          notes: input.notes ? `${opp.notes ?? ""}\n${input.notes}`.trim() : opp.notes,
        },
        include: opportunityInclude,
      });

      if (opp.leadId) {
        await tx.crmLead.update({
          where: { id: opp.leadId },
          data: { status: "CUSTOMER", lifecycleStage: "CUSTOMER", lastActivityAt: new Date() },
        });
      }

      await recordAuditEvent({
        organisationId,
        actorUserId: context.userProfileId,
        action: "opportunity.mark_won",
        resourceType: "CrmOpportunity",
        resourceId: opportunityId,
        metadata: { evidenceType: input.evidenceType, evidenceReference: input.evidenceReference },
      });

      return updated;
    });
  },

  async markLost(
    opportunityId: string,
    brandId: string,
    organisationId: string,
    input: { lossReasonId: string; notes?: string; competitorName?: string; reEngagementEligible?: boolean },
    context: TenantContext,
  ) {
    const check = validateMarkLost(input.lossReasonId, input.notes);
    if (!check.valid) throw new AppError("VALIDATION_ERROR", check.error ?? "Loss reason required.");

    const opp = await this.getOpportunity(opportunityId, brandId, organisationId, context);
    const lossReason = await prisma.crmOpportunityLossReason.findFirst({
      where: { id: input.lossReasonId, organisationId },
    });
    if (!lossReason) throw new AppError("NOT_FOUND", "Loss reason not found.");

    const lostStage = await prisma.crmPipelineStage.findFirst({
      where: { versionId: opp.pipelineVersionId, category: "LOST", isArchived: false },
    });

    return prisma.$transaction(async (tx) => {
      if (lostStage) {
        await tx.crmOpportunityStageHistory.create({
          data: {
            opportunityId,
            previousStageId: opp.currentStageId,
            newStageId: lostStage.id,
            previousCategory: opp.currentStage.category,
            newCategory: "LOST",
            actorUserId: context.userProfileId,
            reason: input.notes ?? lossReason.label,
            source: "MARK_LOST",
          },
        });
      }

      if (input.competitorName) {
        await tx.crmOpportunityCompetitor.create({
          data: { opportunityId, name: input.competitorName, notes: input.notes },
        });
      }

      return tx.crmOpportunity.update({
        where: { id: opportunityId },
        data: {
          status: "LOST",
          lossReasonId: input.lossReasonId,
          lossNotes: input.notes,
          reEngagementEligible: input.reEngagementEligible ?? lossReason.reEngagementDefault,
          probability: 0,
          currentStageId: lostStage?.id ?? opp.currentStageId,
          lastActivityAt: new Date(),
        },
        include: opportunityInclude,
      });
    });
  },

  async getForecast(brandId: string, organisationId: string, context: TenantContext, pipelineId?: string) {
    await brandService.getById(brandId, organisationId, context);
    const opps = await prisma.crmOpportunity.findMany({
      where: { organisationId, brandId, archivedAt: null, ...(pipelineId ? { pipelineId } : {}) },
      include: { values: true, currentStage: true, stageHistory: true },
    });

    const forecastInput = opps.map((o) => {
      const expected = o.values.find((v) => v.valueType === "EXPECTED");
      const wonHistory = o.stageHistory.find((h) => h.newCategory === "WON");
      return {
        id: o.id,
        status: o.status,
        probability: Number(o.probability),
        expectedValue: expected ? Number(expected.amount) : 0,
        currency: o.currency,
        expectedCloseDate: o.expectedCloseDate,
        stageCategory: o.currentStage.category,
        stageEnteredAt: o.stageEnteredAt,
        createdAt: o.createdAt,
        wonAt: wonHistory?.createdAt,
      };
    });

    return computeForecast(forecastInput);
  },

  async getPipelineHealth(brandId: string, organisationId: string, context: TenantContext, pipelineId?: string) {
    await brandService.getById(brandId, organisationId, context);
    const opps = await prisma.crmOpportunity.findMany({
      where: { organisationId, brandId, status: "OPEN", archivedAt: null, ...(pipelineId ? { pipelineId } : {}) },
      include: { values: true, currentStage: true, contactRoles: true, stageHistory: true },
    });

    const healthInput = opps.map((o) => {
      const expected = o.values.find((v) => v.valueType === "EXPECTED");
      const reversals = o.stageHistory.filter((h, i, arr) => {
        if (i === 0) return false;
        const prev = arr[i - 1];
        return h.newStageId !== prev.newStageId;
      }).length;
      return {
        id: o.id,
        name: o.name,
        status: o.status,
        nextAction: o.nextAction,
        expectedCloseDate: o.expectedCloseDate,
        expectedValue: expected ? Number(expected.amount) : undefined,
        lastActivityAt: o.lastActivityAt,
        stageEnteredAt: o.stageEnteredAt,
        maxDurationDays: o.currentStage.maxDurationDays,
        hasDecisionMaker: o.contactRoles.some((r) => r.roleType === "DECISION_MAKER"),
        stageReversalCount: reversals,
      };
    });

    return computePipelineHealth(healthInput);
  },

  async getKanban(pipelineId: string, brandId: string, organisationId: string, context: TenantContext) {
    const pipeline = await prisma.crmPipeline.findFirst({
      where: { id: pipelineId, organisationId, brandId },
      include: {
        versions: { where: { isActive: true }, include: { stages: { where: { isArchived: false, category: { notIn: ["WON", "LOST"] } }, orderBy: { sortOrder: "asc" } } } },
      },
    });
    if (!pipeline) throw new AppError("NOT_FOUND", "Pipeline not found.");

    const stages = pipeline.versions[0]?.stages ?? [];
    const opportunities = await prisma.crmOpportunity.findMany({
      where: { pipelineId, organisationId, brandId, status: "OPEN", archivedAt: null },
      include: { owner: { select: { id: true, displayName: true } }, values: true, company: true },
      orderBy: { updatedAt: "desc" },
    });

    return stages.map((stage) => ({
      stage,
      opportunities: opportunities.filter((o) => o.currentStageId === stage.id),
    }));
  },
};
