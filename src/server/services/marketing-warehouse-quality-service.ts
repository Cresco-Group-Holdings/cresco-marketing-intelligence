import type { DataQualityResolutionAction } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { incrementWarehouseCounter } from "@/lib/warehouse/observability";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

const DEFAULT_RULES = [
  {
    name: "Metric completeness",
    ruleType: "COMPLETENESS" as const,
    targetEntity: "MarketingMetricObservation",
    severity: "MEDIUM" as const,
    ruleExpression: { field: "metricValue", required: true },
  },
  {
    name: "Event freshness",
    ruleType: "FRESHNESS" as const,
    targetEntity: "MarketingEvent",
    severity: "LOW" as const,
    ruleExpression: { maxLagHours: 48 },
  },
];

export const marketingWarehouseQualityService = {
  async ensureDefaultRules(brandId: string, organisationId: string, projectId: string) {
    for (const rule of DEFAULT_RULES) {
      const existing = await prisma.dataQualityRule.findFirst({
        where: { brandId, name: rule.name },
      });
      if (!existing) {
        await prisma.dataQualityRule.create({
          data: {
            organisationId,
            projectId,
            brandId,
            name: rule.name,
            ruleType: rule.ruleType,
            targetEntity: rule.targetEntity,
            severity: rule.severity,
            ruleExpression: rule.ruleExpression,
          },
        });
      }
    }
  },

  async runQualityChecks(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    batchId?: string,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    await this.ensureDefaultRules(brandId, organisationId, brand.projectId);

    const rules = await prisma.dataQualityRule.findMany({
      where: { organisationId, brandId, isActive: true },
    });

    let issuesFound = 0;
    const checks = [];

    for (const rule of rules) {
      let recordsChecked = 0;
      let ruleIssues = 0;

      if (rule.ruleType === "COMPLETENESS" && rule.targetEntity === "MarketingMetricObservation") {
        const observations = await prisma.marketingMetricObservation.findMany({
          where: {
            organisationId,
            brandId,
            metricValue: { equals: 0 },
          },
          take: 100,
          orderBy: { observedAt: "desc" },
        });
        recordsChecked = observations.length;

        for (const observation of observations) {
          const openIssue = await prisma.dataQualityIssue.findFirst({
            where: {
              organisationId,
              brandId,
              dataQualityRuleId: rule.id,
              entityType: "MarketingMetricObservation",
              entityId: observation.id,
              status: "OPEN",
            },
          });
          if (openIssue) {
            continue;
          }

          await prisma.dataQualityIssue.create({
            data: {
              organisationId,
              projectId: brand.projectId,
              brandId,
              dataQualityRuleId: rule.id,
              severity: rule.severity,
              status: "OPEN",
              entityType: "MarketingMetricObservation",
              entityId: observation.id,
              message: `Zero-value metric observation for ${observation.metricKey}`,
              details: { metricKey: observation.metricKey, observedAt: observation.observedAt },
            },
          });
          ruleIssues += 1;
          issuesFound += 1;
        }
      }

      const check = await prisma.dataQualityCheck.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          dataQualityRuleId: rule.id,
          rawMarketingBatchId: batchId,
          status: ruleIssues > 0 ? "FAILED" : "PASSED",
          recordsChecked,
          issuesFound: ruleIssues,
        },
      });
      checks.push(check);
    }

    incrementWarehouseCounter("warehouse.quality_checks_run", checks.length);
    incrementWarehouseCounter("warehouse.quality_issues_found", issuesFound);

    return { checks, issuesFound };
  },

  async listIssues(
    brandId: string,
    organisationId: string,
    filters: {
      status?: string;
      severity?: string;
      cursor?: string;
      limit: number;
    },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);

    const items = await prisma.dataQualityIssue.findMany({
      where: {
        organisationId,
        brandId,
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.severity ? { severity: filters.severity as never } : {}),
      },
      include: {
        dataQualityRule: { select: { name: true, ruleType: true } },
        resolutions: { orderBy: { resolvedAt: "desc" }, take: 1 },
      },
      orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
      take: filters.limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > filters.limit;
    const page = hasMore ? items.slice(0, filters.limit) : items;
    return { items: page, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null };
  },

  async resolveIssue(
    brandId: string,
    organisationId: string,
    input: {
      issueId: string;
      action: DataQualityResolutionAction;
      notes?: string;
    },
    context: TenantContext,
    requestId?: string,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const issue = await prisma.dataQualityIssue.findFirst({
      where: { id: input.issueId, organisationId, brandId },
    });
    if (!issue) {
      throw new AppError("NOT_FOUND", "Quality issue was not found.");
    }

    const resolution = await prisma.$transaction(async (tx) => {
      const created = await tx.dataQualityResolution.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          dataQualityIssueId: issue.id,
          action: input.action,
          notes: input.notes,
          resolvedByUserId: context.userProfileId,
        },
      });

      await tx.dataQualityIssue.update({
        where: { id: issue.id },
        data: {
          status: input.action === "SUPPRESSED" ? "SUPPRESSED" : "RESOLVED",
          resolvedAt: new Date(),
        },
      });

      return created;
    });

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "warehouse.quality.resolved",
      resourceType: "DataQualityIssue",
      resourceId: issue.id,
      requestId,
      metadata: { action: input.action },
    });

    return resolution;
  },
};
