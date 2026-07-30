import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { aggregateReadinessStatus, evaluatePlanReadiness } from "@/lib/advertising-plans/readiness";
import type { TenantContext } from "@/lib/tenancy/context";
import { advertisingCampaignPlanService } from "@/server/services/advertising-campaign-plan-service";

export const advertisingCampaignReadinessService = {
  async runChecks(planId: string, brandId: string, organisationId: string, context: TenantContext) {
    const plan = await advertisingCampaignPlanService.getById(planId, brandId, organisationId, context);

    const checks = evaluatePlanReadiness({
      hasObjective: plan.objectives.length > 0 || !!plan.primaryObjective,
      hasBudget: plan.budgets.length > 0 || !!plan.totalBudgetAmount,
      hasDates: !!plan.startAt && !!plan.endAt,
      hasAudience: plan.audiences.filter((a) => !a.isExclusion).length > 0,
      hasDestination: plan.destinations.length > 0,
      domainVerified: plan.destinations.some((d) => d.pageVerified),
      hasPrimaryConversion: plan.conversionGoals.some((g) => g.isPrimary),
      trackingVerified: plan.conversionGoals.some((g) => g.trackingVerified),
      hasApprovedCreative: plan.creatives.some((c) => c.approvalStatus === "APPROVED"),
      validUtm: plan.destinations.some((d) => !!d.utmTemplate),
      providerAccountAvailable: plan.channels.every((c) => c.eligibilityStatus !== "NEEDS_ACCOUNT"),
      currencyMatch: plan.budgets.every((b) => b.currency === plan.reportingCurrency),
      complianceReviewed: plan.approvals.some((a) => a.approvalType === "COMPLIANCE" && a.decision === "APPROVED"),
      requiredApprovalsComplete: false,
      creativeFormatCompatible: plan.creatives.length > 0,
      unsupportedObjective: false,
    });

    const requiredTypes = ["STRATEGY", "BUDGET", "AUDIENCE", "CREATIVE", "COMPLIANCE", "LAUNCH"];
    const approvedTypes = new Set(
      plan.approvals.filter((a) => a.decision === "APPROVED").map((a) => a.approvalType),
    );
    const allApproved = requiredTypes.every((t) => approvedTypes.has(t as never));

    if (!allApproved) {
      checks.push({
        checkType: "required_approval_missing",
        status: "NOT_READY",
        severity: "HIGH",
        title: "Approvals incomplete",
        description: `Missing approvals: ${requiredTypes.filter((t) => !approvedTypes.has(t as never)).join(", ")}`,
      });
    }

    await prisma.advertisingCampaignReadinessCheck.deleteMany({ where: { planId } });
    for (const check of checks) {
      await prisma.advertisingCampaignReadinessCheck.create({
        data: {
          organisationId,
          planId,
          checkType: check.checkType,
          status: check.status,
          severity: check.severity,
          title: check.title,
          description: check.description,
          evidence: (check.evidence ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    }

    const overallStatus = aggregateReadinessStatus(checks);
    if (overallStatus === "READY_FOR_REVIEW" && plan.status === "PLANNING") {
      await prisma.advertisingCampaignPlan.update({
        where: { id: planId },
        data: { status: "READY_FOR_REVIEW" },
      });
    }

    return { checks, overallStatus };
  },
};
