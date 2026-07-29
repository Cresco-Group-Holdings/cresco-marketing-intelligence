import type { CompliancePolicyCategory } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { CRESCO_POLICY_TEMPLATES } from "@/lib/compliance/policy-templates";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const compliancePolicyService = {
  async list(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.compliancePolicy.findMany({
      where: {
        organisationId,
        OR: [{ brandId }, { brandId: null }],
        isActive: true,
      },
      include: {
        rules: { orderBy: { sortOrder: "asc" } },
        requiredDisclaimers: true,
      },
      orderBy: [{ category: "asc" }, { version: "desc" }],
    });
  },

  async installTemplate(
    brandId: string,
    organisationId: string,
    templateKey: string,
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const template = CRESCO_POLICY_TEMPLATES.find((entry) => entry.templateKey === templateKey);
    if (!template) {
      throw new AppError("NOT_FOUND", "Compliance policy template was not found.");
    }

    const existing = await prisma.compliancePolicy.findFirst({
      where: { organisationId, brandId, slug: template.slug, isActive: true },
      orderBy: { version: "desc" },
    });
    const nextVersion = (existing?.version ?? 0) + 1;

    if (existing) {
      await prisma.compliancePolicy.update({
        where: { id: existing.id },
        data: { isActive: false, effectiveTo: new Date() },
      });
    }

    return prisma.compliancePolicy.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        name: template.name,
        slug: template.slug,
        category: template.category,
        version: nextVersion,
        isTemplate: true,
        templateKey: template.templateKey,
        description: template.description,
        createdByUserId: context.userProfileId,
        rules: {
          create: template.rules.map((rule, index) => ({
            ruleKey: rule.ruleKey,
            category: rule.category,
            title: rule.title,
            description: rule.description,
            riskLevel: rule.riskLevel,
            isBlocking: rule.isBlocking,
            canOverride: rule.canOverride,
            matchPattern: rule.matchPattern,
            sortOrder: index,
          })),
        },
        requiredDisclaimers: {
          create: template.requiredDisclaimers.map((disclaimer) => ({
            disclaimerText: disclaimer.disclaimerText,
            appliesToCategories: disclaimer.appliesToCategories,
            isBlocking: disclaimer.isBlocking,
          })),
        },
      },
      include: { rules: true, requiredDisclaimers: true },
    });
  },

  async createVersion(
    brandId: string,
    organisationId: string,
    policyId: string,
    updates: {
      name?: string;
      description?: string;
      category?: CompliancePolicyCategory;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const current = await prisma.compliancePolicy.findFirst({
      where: { id: policyId, organisationId, brandId },
      include: { rules: true, requiredDisclaimers: true },
    });
    if (!current) throw new AppError("NOT_FOUND", "Compliance policy was not found.");

    const next = await prisma.compliancePolicy.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        name: updates.name ?? current.name,
        slug: current.slug,
        category: updates.category ?? current.category,
        version: current.version + 1,
        isTemplate: current.isTemplate,
        templateKey: current.templateKey,
        description: updates.description ?? current.description,
        createdByUserId: context.userProfileId,
        rules: {
          create: current.rules.map((rule) => ({
            ruleKey: rule.ruleKey,
            category: rule.category,
            title: rule.title,
            description: rule.description,
            riskLevel: rule.riskLevel,
            isBlocking: rule.isBlocking,
            canOverride: rule.canOverride,
            matchPattern: rule.matchPattern,
            ruleConfig: rule.ruleConfig ?? undefined,
            sortOrder: rule.sortOrder,
          })),
        },
        requiredDisclaimers: {
          create: current.requiredDisclaimers.map((disclaimer) => ({
            disclaimerText: disclaimer.disclaimerText,
            appliesToCategories: disclaimer.appliesToCategories,
            appliesToContentTypes: disclaimer.appliesToContentTypes,
            isBlocking: disclaimer.isBlocking,
          })),
        },
      },
      include: { rules: true, requiredDisclaimers: true },
    });

    await prisma.compliancePolicy.update({
      where: { id: current.id },
      data: { isActive: false, effectiveTo: new Date(), supersededByPolicyId: next.id },
    });

    return next;
  },
};
