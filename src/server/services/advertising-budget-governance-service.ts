import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { buildAiRecommendation, validateAiRecommendation } from "@/lib/advertising-budget-governance/ai-recommendations";
import { evaluateBudgetAlerts } from "@/lib/advertising-budget-governance/alerts";
import { evaluateApprovalPolicy, canRoleApprove } from "@/lib/advertising-budget-governance/approval-policy";
import {
  assertNoAutonomousSpendIncrease,
  validateChangeRequest,
} from "@/lib/advertising-budget-governance/change-requests";
import { aggregateCrossProviderSpend, type FxRate } from "@/lib/advertising-budget-governance/currency";
import {
  applyEmergencyControl,
  canMutateBudget,
  createInitialEmergencyState,
  resolveEmergencyState,
  validateRestoration,
  type EmergencyControlType,
} from "@/lib/advertising-budget-governance/emergency-controls";
import { calculatePacing } from "@/lib/advertising-budget-governance/pacing";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

const policyInclude = {
  limits: true,
  createdBy: { select: { id: true, displayName: true } },
} satisfies Prisma.AdvertisingBudgetPolicyInclude;

export type CreateChangeRequestInput = {
  requestType: string;
  reason: string;
  evidence?: string;
  provider?: string;
  scopeType?: string;
  scopeId?: string;
  currency: string;
  currentBudget: number;
  proposedBudget: number;
  projectedImpact?: string;
  risk?: string;
};

export const advertisingBudgetGovernanceService = {
  async getDashboard(brandId: string, organisationId: string, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const [policies, allocations, alerts, requests, incidents, snapshots] = await Promise.all([
      prisma.advertisingBudgetPolicy.findMany({
        where: { organisationId, OR: [{ brandId }, { brandId: null }] },
        include: policyInclude,
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.advertisingBudgetAllocation.findMany({
        where: { organisationId, brandId },
        orderBy: { periodStart: "desc" },
        take: 20,
      }),
      prisma.advertisingBudgetAlert.findMany({
        where: { organisationId, brandId, acknowledged: false },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.advertisingBudgetChangeRequest.findMany({
        where: { organisationId, brandId },
        include: { approvals: true, requestedBy: { select: { id: true, displayName: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.advertisingSpendIncident.findMany({
        where: { organisationId, brandId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.advertisingPacingSnapshot.findMany({
        where: { organisationId, brandId },
        orderBy: { computedAt: "desc" },
        take: 10,
      }),
    ]);

    const activeIncidents = incidents.map((i) => ({
      type: i.incidentType as EmergencyControlType,
      reason: i.reason,
      scopeId: i.scopeId ?? undefined,
    }));
    let emergencyState = createInitialEmergencyState();
    for (const inc of activeIncidents) {
      emergencyState = applyEmergencyControl(emergencyState, {
        controlType: inc.type,
        reason: inc.reason,
        scopeId: inc.scopeId,
      });
    }

    return {
      brand: { id: brand.id, name: brand.name },
      policies,
      allocations,
      alerts,
      changeRequests: requests,
      incidents,
      pacingSnapshots: snapshots,
      emergencyState,
      mutationAllowed: canMutateBudget(emergencyState),
    };
  },

  async computePacing(
    brandId: string,
    organisationId: string,
    input: {
      totalBudget: number;
      actualSpend: number;
      currency: string;
      reportingCurrency?: string;
      periodStart: string;
      periodEnd: string;
      provider?: string;
      scopeType?: string;
      scopeId?: string;
      fxRates?: FxRate[];
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    const pacing = calculatePacing({
      periodStart,
      periodEnd,
      totalBudget: input.totalBudget,
      actualSpend: input.actualSpend,
    });

    const reportingCurrency = input.reportingCurrency ?? input.currency;
    let fxRate: number | null = null;
    let fxRateDate: Date | null = null;
    let fxRateSource: string | null = null;
    let fxRateMissing = false;

    if (input.currency !== reportingCurrency && input.fxRates?.length) {
      const rate = input.fxRates.find(
        (r) => r.fromCurrency === input.currency && r.toCurrency === reportingCurrency,
      );
      if (rate) {
        fxRate = rate.rate;
        fxRateDate = rate.rateDate;
        fxRateSource = rate.source;
      } else {
        fxRateMissing = true;
      }
    } else if (input.currency === reportingCurrency) {
      fxRate = 1;
      fxRateSource = "identity";
      fxRateDate = new Date();
    }

    const snapshot = await prisma.advertisingPacingSnapshot.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        provider: input.provider,
        scopeType: input.scopeType ?? "BRAND",
        scopeId: input.scopeId ?? brandId,
        currency: input.currency,
        reportingCurrency,
        fxRate,
        fxRateDate,
        fxRateSource,
        fxRateMissing,
        periodStart,
        periodEnd,
        elapsedTimePct: pacing.elapsedTimePct,
        totalBudget: input.totalBudget,
        elapsedBudgetPct: pacing.elapsedBudgetPct,
        expectedSpend: pacing.expectedSpend,
        actualSpend: pacing.actualSpend,
        spendVariance: pacing.spendVariance,
        projectedSpend: pacing.projectedSpend,
        remainingBudget: pacing.remainingBudget,
        requiredDailyPace: pacing.requiredDailyPace,
        overspendRisk: pacing.overspendRisk,
        underspendRisk: pacing.underspendRisk,
      },
    });

    const alertCandidates = evaluateBudgetAlerts({ pacing, totalBudget: input.totalBudget });
    for (const alert of alertCandidates) {
      await prisma.advertisingBudgetAlert.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          alertType: alert.alertType as Prisma.AdvertisingBudgetAlertCreateInput["alertType"],
          severity: alert.severity,
          message: alert.message,
          provider: input.provider,
          scopeType: input.scopeType,
          scopeId: input.scopeId,
        },
      });
    }

    return { pacing, snapshot, alerts: alertCandidates };
  },

  async createPolicy(
    brandId: string,
    organisationId: string,
    input: {
      name: string;
      isDefault?: boolean;
      marketerCanRequest?: boolean;
      adminApprovalThresholdPct?: number;
      ownerApprovalThresholdPct?: number;
      hardLimitPct?: number;
      clientApprovalRequired?: boolean;
      dailyChangeLimitPct?: number;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingBudgetPolicy.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        name: input.name,
        isDefault: input.isDefault ?? false,
        marketerCanRequest: input.marketerCanRequest ?? true,
        adminApprovalThresholdPct: input.adminApprovalThresholdPct ?? 10,
        ownerApprovalThresholdPct: input.ownerApprovalThresholdPct ?? 25,
        hardLimitPct: input.hardLimitPct ?? 50,
        clientApprovalRequired: input.clientApprovalRequired ?? false,
        dailyChangeLimitPct: input.dailyChangeLimitPct ?? 20,
        createdByUserId: context.userProfileId,
      },
      include: policyInclude,
    });
  },

  async createChangeRequest(
    brandId: string,
    organisationId: string,
    input: CreateChangeRequestInput,
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const validation = validateChangeRequest(input);
    if (!validation.valid) {
      throw new AppError("VALIDATION_ERROR", validation.errors.join(" "));
    }

    const policy = await prisma.advertisingBudgetPolicy.findFirst({
      where: { organisationId, OR: [{ brandId }, { brandId: null, isDefault: true }] },
      orderBy: { isDefault: "desc" },
    });

    const approvalEval = evaluateApprovalPolicy({
      policy: {
        marketerCanRequest: policy?.marketerCanRequest ?? true,
        adminApprovalThresholdPct: Number(policy?.adminApprovalThresholdPct ?? 10),
        ownerApprovalThresholdPct: Number(policy?.ownerApprovalThresholdPct ?? 25),
        hardLimitPct: Number(policy?.hardLimitPct ?? 50),
        clientApprovalRequired: policy?.clientApprovalRequired ?? false,
      },
      requesterRole: context.organisationRole,
      percentageChange: validation.percentageChange,
      isIncrease: validation.isIncrease,
    });

    if (!approvalEval.canRequest || approvalEval.autoReject) {
      throw new AppError("VALIDATION_ERROR", approvalEval.reason);
    }

    const autonomousCheck = assertNoAutonomousSpendIncrease(input.requestType, false);
    if (!autonomousCheck.allowed && validation.isIncrease) {
      throw new AppError("VALIDATION_ERROR", autonomousCheck.reason);
    }

    return prisma.advertisingBudgetChangeRequest.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        policyId: policy?.id,
        requestType: input.requestType as Prisma.AdvertisingBudgetChangeRequestCreateInput["requestType"],
        status: "PENDING",
        reason: input.reason,
        evidence: input.evidence,
        provider: input.provider,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        currency: input.currency,
        currentBudget: input.currentBudget,
        proposedBudget: input.proposedBudget,
        percentageChange: validation.percentageChange,
        projectedImpact: input.projectedImpact,
        risk: input.risk,
        requestedByUserId: context.userProfileId,
      },
      include: { requestedBy: { select: { id: true, displayName: true } } },
    });
  },

  async approveChangeRequest(
    changeRequestId: string,
    brandId: string,
    organisationId: string,
    notes: string | undefined,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const request = await prisma.advertisingBudgetChangeRequest.findFirst({
      where: { id: changeRequestId, organisationId, brandId },
    });
    if (!request) throw new AppError("NOT_FOUND", "Change request not found.");
    if (request.status !== "PENDING") {
      throw new AppError("VALIDATION_ERROR", `Request is already ${request.status}.`);
    }

    const policy = request.policyId
      ? await prisma.advertisingBudgetPolicy.findUnique({ where: { id: request.policyId } })
      : null;

    const approvalEval = evaluateApprovalPolicy({
      policy: {
        marketerCanRequest: policy?.marketerCanRequest ?? true,
        adminApprovalThresholdPct: Number(policy?.adminApprovalThresholdPct ?? 10),
        ownerApprovalThresholdPct: Number(policy?.ownerApprovalThresholdPct ?? 25),
        hardLimitPct: Number(policy?.hardLimitPct ?? 50),
        clientApprovalRequired: policy?.clientApprovalRequired ?? false,
      },
      requesterRole: context.organisationRole,
      percentageChange: Number(request.percentageChange),
      isIncrease: Number(request.proposedBudget) > Number(request.currentBudget),
    });

    if (!canRoleApprove(context.organisationRole, approvalEval.requiredApprover)) {
      throw new AppError("FORBIDDEN", `This change requires ${approvalEval.requiredApprover} approval.`);
    }

    const incidents = await prisma.advertisingSpendIncident.findMany({
      where: { organisationId, brandId, status: "ACTIVE" },
    });
    let emergencyState = createInitialEmergencyState();
    for (const inc of incidents) {
      emergencyState = applyEmergencyControl(emergencyState, {
        controlType: inc.incidentType as EmergencyControlType,
        reason: inc.reason,
        scopeId: inc.scopeId ?? undefined,
      });
    }
    const mutationCheck = canMutateBudget(emergencyState);
    if (!mutationCheck.allowed) {
      throw new AppError("VALIDATION_ERROR", mutationCheck.blockers.join(" "));
    }

    const autonomousCheck = assertNoAutonomousSpendIncrease(request.requestType, true);
    if (!autonomousCheck.allowed) {
      throw new AppError("VALIDATION_ERROR", autonomousCheck.reason);
    }

    return prisma.$transaction(async (tx) => {
      await tx.advertisingBudgetApproval.create({
        data: {
          changeRequestId,
          approverUserId: context.userProfileId,
          decision: "APPROVED",
          notes,
        },
      });
      return tx.advertisingBudgetChangeRequest.update({
        where: { id: changeRequestId },
        data: { status: "APPROVED" },
        include: { approvals: true, requestedBy: { select: { id: true, displayName: true } } },
      });
    });
  },

  async rejectChangeRequest(
    changeRequestId: string,
    brandId: string,
    organisationId: string,
    notes: string | undefined,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const request = await prisma.advertisingBudgetChangeRequest.findFirst({
      where: { id: changeRequestId, organisationId, brandId, status: "PENDING" },
    });
    if (!request) throw new AppError("NOT_FOUND", "Pending change request not found.");

    return prisma.$transaction(async (tx) => {
      await tx.advertisingBudgetApproval.create({
        data: {
          changeRequestId,
          approverUserId: context.userProfileId,
          decision: "REJECTED",
          notes,
        },
      });
      return tx.advertisingBudgetChangeRequest.update({
        where: { id: changeRequestId },
        data: { status: "REJECTED" },
        include: { approvals: true },
      });
    });
  },

  async acknowledgeAlert(alertId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const alert = await prisma.advertisingBudgetAlert.findFirst({
      where: { id: alertId, organisationId, brandId },
    });
    if (!alert) throw new AppError("NOT_FOUND", "Alert not found.");
    return prisma.advertisingBudgetAlert.update({
      where: { id: alertId },
      data: { acknowledged: true, acknowledgedAt: new Date() },
    });
  },

  async triggerEmergency(
    brandId: string,
    organisationId: string,
    input: {
      incidentType: EmergencyControlType;
      reason: string;
      provider?: string;
      scopeType?: string;
      scopeId?: string;
      providerMutationShutdown?: boolean;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingSpendIncident.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        incidentType: input.incidentType,
        status: "ACTIVE",
        reason: input.reason,
        provider: input.provider,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        providerMutationShutdown: input.providerMutationShutdown ?? input.incidentType === "PROVIDER_MUTATION_SHUTDOWN",
        restorationRequiresApproval: true,
      },
    });
  },

  async resolveIncident(
    incidentId: string,
    brandId: string,
    organisationId: string,
    restorationApproved: boolean,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const incident = await prisma.advertisingSpendIncident.findFirst({
      where: { id: incidentId, organisationId, brandId, status: "ACTIVE" },
    });
    if (!incident) throw new AppError("NOT_FOUND", "Active incident not found.");

    const restoration = validateRestoration(
      applyEmergencyControl(createInitialEmergencyState(), {
        controlType: incident.incidentType as EmergencyControlType,
        reason: incident.reason,
      }),
      restorationApproved,
    );
    if (!restoration.allowed) {
      throw new AppError("VALIDATION_ERROR", restoration.reason);
    }

    return prisma.advertisingSpendIncident.update({
      where: { id: incidentId },
      data: {
        status: "RESOLVED",
        resolvedByUserId: context.userProfileId,
        resolvedAt: new Date(),
      },
    });
  },

  async recordObservation(
    brandId: string,
    organisationId: string,
    input: {
      provider: string;
      currency: string;
      spendAmount: number;
      observedAt: string;
      accountId?: string;
      campaignId?: string;
      experimentId?: string;
      impressions?: number;
      clicks?: number;
      conversions?: number;
      hasTracking?: boolean;
      isStale?: boolean;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingSpendObservation.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        provider: input.provider,
        accountId: input.accountId,
        campaignId: input.campaignId,
        experimentId: input.experimentId,
        currency: input.currency,
        spendAmount: input.spendAmount,
        impressions: input.impressions,
        clicks: input.clicks,
        conversions: input.conversions,
        observedAt: new Date(input.observedAt),
        hasTracking: input.hasTracking ?? true,
        isStale: input.isStale ?? false,
      },
    });
  },

  async aggregateSpend(
    brandId: string,
    organisationId: string,
    reportingCurrency: string,
    fxRates: FxRate[],
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const observations = await prisma.advertisingSpendObservation.findMany({
      where: { organisationId, brandId },
      orderBy: { observedAt: "desc" },
      take: 500,
    });

    const byProvider = new Map<string, { amount: number; currency: string }>();
    for (const obs of observations) {
      const key = obs.provider;
      const existing = byProvider.get(key);
      const amount = Number(obs.spendAmount);
      if (existing) {
        if (existing.currency === obs.currency) {
          existing.amount += amount;
        }
      } else {
        byProvider.set(key, { amount, currency: obs.currency });
      }
    }

    return aggregateCrossProviderSpend({
      reportingCurrency,
      rates: fxRates,
      observations: Array.from(byProvider.entries()).map(([provider, data]) => ({
        provider,
        amount: data.amount,
        currency: data.currency,
      })),
    });
  },

  async createAiRecommendation(
    brandId: string,
    organisationId: string,
    input: {
      recommendationType: string;
      evidence: string;
      uncertainty: string;
      budgetImpact: string;
      measurementPlan: string;
    },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const validation = validateAiRecommendation(input);
    if (!validation.valid) {
      throw new AppError("VALIDATION_ERROR", validation.errors.join(" "));
    }
    return buildAiRecommendation(input);
  },
};
