import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { RANKING_DISCLAIMER } from "@/lib/on-page/constants";
import type { TenantContext } from "@/lib/tenancy/context";
import { onPageAuditService } from "@/server/services/on-page-audit-service";

export const onPageComparisonService = {
  async compare(
    auditId: string,
    brandId: string,
    organisationId: string,
    input: {
      comparisonType: string;
      baselineVersionId?: string;
      compareVersionId?: string;
    },
    context: TenantContext,
  ) {
    const audit = await onPageAuditService.getById(auditId, brandId, organisationId, context);

    const baselineVersion = input.baselineVersionId
      ? audit.versions.find((v) => v.id === input.baselineVersionId)
      : audit.versions[1];
    const compareVersion = input.compareVersionId
      ? audit.versions.find((v) => v.id === input.compareVersionId)
      : audit.versions[0];

    if (!compareVersion) {
      throw new AppError("VALIDATION_ERROR", "No version available for comparison.");
    }

    const baselineFindings = baselineVersion
      ? await prisma.onPageSeoFinding.findMany({
          where: { auditId, versionId: baselineVersion.id },
        })
      : [];

    const compareFindings = await prisma.onPageSeoFinding.findMany({
      where: { auditId, versionId: compareVersion.id },
    });

    const resolvedRuleIds = baselineFindings
      .filter((bf) => !compareFindings.some((cf) => cf.ruleId === bf.ruleId && cf.status === "OPEN"))
      .map((f) => f.ruleId);

    const newRuleIds = compareFindings
      .filter((cf) => cf.status === "OPEN" && !baselineFindings.some((bf) => bf.ruleId === cf.ruleId))
      .map((f) => f.ruleId);

    const diffSummary = {
      baselineVersion: baselineVersion?.versionNumber,
      compareVersion: compareVersion.versionNumber,
      resolvedIssues: resolvedRuleIds,
      newIssues: newRuleIds,
      openFindings: compareFindings.filter((f) => f.status === "OPEN").length,
      note: "Comparison is advisory. Rankings improvements are not guaranteed.",
    };

    return prisma.onPageSeoComparison.create({
      data: {
        organisationId,
        auditId,
        comparisonType: input.comparisonType as "PREVIOUS_AUDIT",
        baselineVersionId: baselineVersion?.id,
        compareVersionId: compareVersion.id,
        diffSummary: diffSummary as Prisma.InputJsonValue,
        disclaimer: RANKING_DISCLAIMER,
      },
    });
  },

  async listComparisons(auditId: string, brandId: string, organisationId: string, context: TenantContext) {
    await onPageAuditService.getById(auditId, brandId, organisationId, context);
    return prisma.onPageSeoComparison.findMany({
      where: { auditId, organisationId },
      orderBy: { createdAt: "desc" },
    });
  },
};
