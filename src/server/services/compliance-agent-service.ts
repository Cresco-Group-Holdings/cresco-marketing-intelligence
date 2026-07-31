import type { ContentComplianceCheckType } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  hasOpenBlockingFindings,
  runDeterministicComplianceChecks,
} from "@/lib/compliance/deterministic-checks";
import { isNonOverridable } from "@/lib/compliance/constants";
import type { ComplianceDismissInput, ComplianceOverrideInput } from "@/lib/validation/compliance";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

const LEGACY_TYPE_MAP: Record<string, ContentComplianceCheckType> = {
  MISSING_REQUIRED_DISCLAIMER: "MISSING_DISCLAIMER",
  PROHIBITED_CLAIM: "PROHIBITED_CLAIM",
  INVALID_DESTINATION_URL: "MISSING_DESTINATION_URL",
  MISSING_ALT_TEXT: "MISSING_ALT_TEXT",
  UNAPPROVED_LOGO: "UNAPPROVED_ASSET",
  EXPIRED_LICENCE: "EXPIRED_ASSET_LICENCE",
  UNSUPPORTED_PLATFORM_FORMAT: "UNSUPPORTED_PLATFORM_FORMAT",
  EXCESSIVE_PLATFORM_LENGTH: "EXCESSIVE_TEXT_LENGTH",
  MISSING_LICENCE: "UNAPPROVED_MUSIC",
  MISSING_CONSENT: "MISSING_CONSENT",
};

async function loadContentForCompliance(
  organisationId: string,
  brandId: string,
  contentItemId: string,
) {
  const item = await prisma.contentItem.findFirst({
    where: { id: contentItemId, organisationId, brandId, archivedAt: null },
    include: {
      variants: true,
      assets: { include: { marketingAsset: true } },
      provenance: true,
      complianceChecks: true,
    },
  });
  if (!item) throw new AppError("NOT_FOUND", "Content item was not found.");
  return item;
}

export const complianceAgentService = {
  async evaluate(
    brandId: string,
    organisationId: string,
    contentItemId: string,
    context: TenantContext,
    options?: { contentVariantId?: string; requestId?: string },
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const item = await loadContentForCompliance(organisationId, brandId, contentItemId);

    const policies = await prisma.compliancePolicy.findMany({
      where: { organisationId, OR: [{ brandId }, { brandId: null }], isActive: true },
      include: { rules: true, requiredDisclaimers: true },
    });
    const policy = policies[0];
    if (!policy) {
      throw new AppError("VALIDATION_ERROR", "No active compliance policy is configured for this brand.");
    }

    const prohibitedClaims = await prisma.brandComplianceRule.findMany({
      where: {
        brandId,
        organisationId,
        archivedAt: null,
        ruleType: "PROHIBITED_CLAIM",
      },
      select: { ruleText: true },
    });

    const deterministicFindings = runDeterministicComplianceChecks({
      complianceInput: {
        contentType: item.contentType,
        primaryMessage: item.primaryMessage,
        destinationUrl: item.destinationUrl,
        disclaimer: item.primaryMessage,
        prohibitedClaims: prohibitedClaims.map((rule) => rule.ruleText),
        variants: item.variants.map((variant) => ({
          id: variant.id,
          provider: variant.provider,
          format: variant.format,
          caption: variant.caption,
          altText: variant.altText,
          destinationUrl: variant.destinationUrl,
        })),
        assets: item.assets.map((asset) => ({
          id: asset.marketingAssetId,
          approvedForMarketing: asset.marketingAsset.approvedForMarketing,
          licenceExpiresAt: asset.marketingAsset.licenceExpiresAt,
          attributionRequired: asset.marketingAsset.attributionRequired,
        })),
        provenance: item.provenance,
      },
      rules: policy.rules,
      requiredDisclaimers: policy.requiredDisclaimers,
      disclaimer: item.primaryMessage,
    });

    const evaluation = await prisma.complianceEvaluation.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        contentItemId,
        contentVariantId: options?.contentVariantId,
        policyId: policy.id,
        policyVersion: policy.version,
        status: "COMPLETED",
        source: "DETERMINISTIC",
        evaluatedAt: new Date(),
        evaluatedByUserId: context.userProfileId,
        findings: {
          create: deterministicFindings.map((finding) => ({
            ruleId: finding.ruleId,
            ruleReference: finding.ruleKey,
            source: "DETERMINISTIC",
            category: finding.category,
            riskLevel: finding.riskLevel,
            isBlocking: finding.isBlocking,
            status: "OPEN",
            excerpt: finding.excerpt,
            message: finding.message,
            contentVariantId: finding.contentVariantId,
          })),
        },
      },
      include: { findings: true, policy: true },
    });

    await prisma.contentComplianceCheck.deleteMany({ where: { contentItemId } });
    if (evaluation.findings.length > 0) {
      await prisma.contentComplianceCheck.createMany({
        data: evaluation.findings.map((finding) => ({
          organisationId,
          projectId: brand.projectId,
          brandId,
          contentItemId,
          contentVariantId: finding.contentVariantId,
          checkType: LEGACY_TYPE_MAP[finding.ruleReference ?? ""] ?? "PROHIBITED_CLAIM",
          result: finding.isBlocking ? "FAIL" : finding.riskLevel === "INFO" ? "PASS" : "WARNING",
          message: finding.message,
          blocking: finding.isBlocking,
          metadata: { evaluationId: evaluation.id, findingId: finding.id },
        })),
      });
    }

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "content.complianceChecked",
      resourceType: "complianceEvaluation",
      resourceId: evaluation.id,
      requestId: options?.requestId,
      metadata: {
        findingCount: evaluation.findings.length,
        blockingCount: evaluation.findings.filter((f) => f.isBlocking).length,
      },
    });

    return evaluation;
  },

  async getLatestEvaluation(organisationId: string, brandId: string, contentItemId: string) {
    return prisma.complianceEvaluation.findFirst({
      where: { organisationId, brandId, contentItemId },
      include: {
        findings: {
          include: { overrides: true },
          orderBy: { createdAt: "desc" },
        },
        policy: true,
        overrides: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async assertPublishable(
    brandId: string,
    organisationId: string,
    contentItemId: string,
    context: TenantContext,
    contentVariantId?: string,
  ) {
    let evaluation = await this.getLatestEvaluation(organisationId, brandId, contentItemId);
    if (!evaluation) {
      await this.evaluate(brandId, organisationId, contentItemId, context, { contentVariantId });
      evaluation = await this.getLatestEvaluation(organisationId, brandId, contentItemId);
    }
    if (!evaluation) {
      throw new AppError("VALIDATION_ERROR", "Compliance evaluation could not be completed.");
    }

    const openBlocking = evaluation.findings.filter(
      (finding) =>
        finding.isBlocking &&
        finding.status === "OPEN" &&
        (!contentVariantId || !finding.contentVariantId || finding.contentVariantId === contentVariantId),
    );

    if (hasOpenBlockingFindings(openBlocking)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Unresolved blocking compliance issues prevent publication.",
      );
    }
  },

  async overrideFinding(
    brandId: string,
    organisationId: string,
    contentItemId: string,
    input: ComplianceOverrideInput,
    context: TenantContext,
    requestId?: string,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const evaluation = await this.getLatestEvaluation(organisationId, brandId, contentItemId);
    if (!evaluation) throw new AppError("NOT_FOUND", "Compliance evaluation was not found.");

    const finding = evaluation.findings.find((entry) => entry.id === input.findingId);
    if (!finding) throw new AppError("NOT_FOUND", "Compliance finding was not found.");
    if (!finding.ruleReference || isNonOverridable(finding.ruleReference)) {
      throw new AppError("VALIDATION_ERROR", "This technical finding cannot be overridden.");
    }
    if (finding.isBlocking === false) {
      throw new AppError("VALIDATION_ERROR", "Only blocking findings require an override to publish.");
    }

    const override = await prisma.complianceOverride.create({
      data: {
        organisationId,
        evaluationId: evaluation.id,
        findingId: finding.id,
        policyId: evaluation.policyId,
        contentItemId,
        contentVariantId: finding.contentVariantId,
        reason: input.reason,
        userId: context.userProfileId,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });

    await prisma.complianceFinding.update({
      where: { id: finding.id },
      data: { status: "OVERRIDDEN" },
    });

    await recordAuditEvent({
      organisationId,
      projectId: evaluation.projectId,
      actorUserId: context.userProfileId,
      action: "content.complianceOverridden",
      resourceType: "complianceOverride",
      resourceId: override.id,
      requestId,
      metadata: { findingId: finding.id },
    });

    return override;
  },

  async dismissFinding(
    brandId: string,
    organisationId: string,
    contentItemId: string,
    input: ComplianceDismissInput,
    context: TenantContext,
    requestId?: string,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const evaluation = await this.getLatestEvaluation(organisationId, brandId, contentItemId);
    if (!evaluation) throw new AppError("NOT_FOUND", "Compliance evaluation was not found.");

    const finding = evaluation.findings.find((entry) => entry.id === input.findingId);
    if (!finding) throw new AppError("NOT_FOUND", "Compliance finding was not found.");
    if (finding.isBlocking) {
      throw new AppError("VALIDATION_ERROR", "Blocking findings cannot be dismissed; use override instead.");
    }

    await prisma.complianceFinding.update({
      where: { id: finding.id },
      data: { status: "DISMISSED", explanation: input.reason },
    });

    await recordAuditEvent({
      organisationId,
      projectId: evaluation.projectId,
      actorUserId: context.userProfileId,
      action: "content.complianceDismissed",
      resourceType: "complianceFinding",
      resourceId: finding.id,
      requestId,
    });
  },
};
