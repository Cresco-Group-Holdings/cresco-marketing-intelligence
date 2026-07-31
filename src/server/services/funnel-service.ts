import type {
  FunnelCountingMethod,
  FunnelStepRequirement,
  FunnelStepType,
  FunnelTemplateType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { CRESCO_INTERNAL_ORG_SLUG } from "@/lib/funnel/constants";
import { getFunnelTemplate } from "@/lib/funnel/templates";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const funnelService = {
  async listFunnels(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.marketingFunnel.findMany({
      where: { brandId, organisationId, isActive: true },
      include: {
        versions: {
          include: { steps: { orderBy: { stepOrder: "asc" } } },
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  },

  async getFunnel(brandId: string, organisationId: string, funnelId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const funnel = await prisma.marketingFunnel.findFirst({
      where: { id: funnelId, brandId, organisationId },
      include: {
        versions: {
          include: { steps: { orderBy: { stepOrder: "asc" } } },
          orderBy: { versionNumber: "desc" },
        },
      },
    });
    if (!funnel) throw new AppError("NOT_FOUND", "Funnel was not found.");
    return funnel;
  },

  async createFunnel(
    brandId: string,
    organisationId: string,
    input: {
      name: string;
      description?: string;
      countingMethod?: FunnelCountingMethod;
      templateType?: FunnelTemplateType;
      isTemplate?: boolean;
      steps: Array<{
        name: string;
        stepType: FunnelStepType;
        matchingRules: Prisma.InputJsonValue;
        maxTimeToNextStepMs?: number;
        requirement?: FunnelStepRequirement;
      }>;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);

    return prisma.$transaction(async (tx) => {
      const funnel = await tx.marketingFunnel.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          name: input.name,
          description: input.description,
          countingMethod: input.countingMethod ?? "USER",
          templateType: input.templateType,
          isTemplate: input.isTemplate ?? false,
        },
      });

      const version = await tx.marketingFunnelVersion.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          funnelId: funnel.id,
          versionNumber: 1,
          countingMethod: input.countingMethod ?? "USER",
          changelog: "Initial version",
          createdByUserId: context.userProfileId,
        },
      });

      for (let index = 0; index < input.steps.length; index++) {
        const step = input.steps[index]!;
        await tx.marketingFunnelStep.create({
          data: {
            organisationId,
            projectId: brand.projectId,
            brandId,
            funnelVersionId: version.id,
            stepOrder: index + 1,
            name: step.name,
            stepType: step.stepType,
            matchingRules: step.matchingRules,
            maxTimeToNextStepMs: step.maxTimeToNextStepMs,
            requirement: step.requirement ?? "REQUIRED",
          },
        });
      }

      await tx.marketingFunnel.update({
        where: { id: funnel.id },
        data: { currentVersionId: version.id },
      });

      return this.getFunnel(brandId, organisationId, funnel.id, context);
    });
  },

  async createFromTemplate(
    brandId: string,
    organisationId: string,
    templateType: FunnelTemplateType,
    context: TenantContext,
  ) {
    const org = await prisma.organisation.findFirst({ where: { id: organisationId } });
    if (!org || org.slug !== CRESCO_INTERNAL_ORG_SLUG) {
      throw new AppError(
        "FORBIDDEN",
        "Cresco funnel templates are only available for the internal Cresco organisation.",
      );
    }

    const template = getFunnelTemplate(templateType);
    return this.createFunnel(
      brandId,
      organisationId,
      {
        name: template.name,
        description: template.description,
        templateType: template.templateType,
        isTemplate: true,
        steps: template.steps.map((step) => ({
          name: step.name,
          stepType: step.stepType,
          matchingRules: step.matchingRules,
          maxTimeToNextStepMs: step.maxTimeToNextStepMs,
          requirement: step.requirement ?? "REQUIRED",
        })),
      },
      context,
    );
  },

  async listAvailableTemplates(organisationId: string) {
    const org = await prisma.organisation.findFirst({ where: { id: organisationId } });
    if (!org || org.slug !== CRESCO_INTERNAL_ORG_SLUG) {
      return [];
    }
    return Object.values({
      CRESCO_GRANTS: getFunnelTemplate("CRESCO_GRANTS"),
      CAPITAL_CRESCO_TERMINAL: getFunnelTemplate("CAPITAL_CRESCO_TERMINAL"),
    }).map((t) => ({
      templateType: t.templateType,
      name: t.name,
      description: t.description,
      stepCount: t.steps.length,
    }));
  },
};
