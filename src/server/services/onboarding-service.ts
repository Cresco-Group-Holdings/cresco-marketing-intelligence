import {
  BrandStatus,
  MarketingChannel,
  MarketingObjectiveStatus,
  OnboardingStepKey,
  Prisma,
  ProjectStatus,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  getNextOnboardingStep,
  getPreviousOnboardingStep,
  ONBOARDING_STEPS,
} from "@/lib/onboarding/constants";
import { CRESCO_INTERNAL_TEMPLATE, getOnboardingTemplate } from "@/lib/onboarding/cresco-template";
import { MARKETING_OBJECTIVE_LABELS } from "@/lib/onboarding/marketing";
import { slugFromName } from "@/lib/utils/slug";
import { recordAuditEvent } from "@/server/services/audit-service";
import {
  organisationService,
  projectService,
  brandService,
  brandProfileService,
  workspaceService,
} from "@/server/services/workspace-service";
import { buildTenantContextForUser } from "@/lib/tenancy/guards";
import type {
  accountProfileStepSchema,
  brandProfileStepSchema,
  brandStepSchema,
  channelPreferencesStepSchema,
  marketingObjectivesStepSchema,
  organisationStepSchema,
  projectStepSchema,
} from "@/lib/validation/onboarding";
import type { z } from "zod";

type AccountProfileInput = z.infer<typeof accountProfileStepSchema>;
type OrganisationInput = z.infer<typeof organisationStepSchema>;
type ProjectInput = z.infer<typeof projectStepSchema>;
type BrandInput = z.infer<typeof brandStepSchema>;
type BrandProfileInput = z.infer<typeof brandProfileStepSchema>;
type MarketingObjectivesInput = z.infer<typeof marketingObjectivesStepSchema>;
type ChannelPreferencesInput = z.infer<typeof channelPreferencesStepSchema>;

async function ensureProgress(userProfileId: string) {
  return prisma.onboardingProgress.upsert({
    where: { userId: userProfileId },
    update: {},
    create: {
      userId: userProfileId,
      currentStep: OnboardingStepKey.ACCOUNT_PROFILE,
      completedSteps: [],
    },
  });
}

async function markStepComplete(
  userProfileId: string,
  step: OnboardingStepKey,
  nextStep: OnboardingStepKey | null,
  extra?: Prisma.OnboardingProgressUpdateInput,
) {
  const progress = await ensureProgress(userProfileId);
  const completedSteps = Array.from(new Set([...progress.completedSteps, step]));

  return prisma.onboardingProgress.update({
    where: { userId: userProfileId },
    data: {
      completedSteps,
      currentStep: nextStep ?? step,
      ...extra,
    },
  });
}

async function assertOnboardingScope(
  userProfileId: string,
  organisationId: string,
  projectId?: string,
  brandId?: string,
) {
  const membership = await prisma.organisationMembership.findFirst({
    where: {
      userId: userProfileId,
      organisationId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (!membership) {
    throw new AppError("FORBIDDEN", "Organisation is not accessible.");
  }

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organisationId, archivedAt: null },
      select: { id: true },
    });
    if (!project) {
      throw new AppError("NOT_FOUND", "Project was not found in this organisation.");
    }
  }

  if (brandId && projectId) {
    const brand = await prisma.brand.findFirst({
      where: { id: brandId, organisationId, projectId, archivedAt: null },
      select: { id: true },
    });
    if (!brand) {
      throw new AppError("NOT_FOUND", "Brand was not found in this organisation.");
    }
  }
}

export const onboardingService = {
  async getState(userProfileId: string) {
    const [progress, profile, workspace] = await Promise.all([
      ensureProgress(userProfileId),
      prisma.userProfile.findUnique({ where: { id: userProfileId } }),
      workspaceService.getResolvedWorkspace(userProfileId),
    ]);

    let organisation = null;
    let project = null;
    let brand = null;
    let brandProfile = null;
    let objectives: Awaited<ReturnType<typeof prisma.marketingObjective.findMany>> = [];
    let channelPreferences: Awaited<ReturnType<typeof prisma.brandChannelPreference.findMany>> = [];
    let templateProjects: Array<{ id: string; name: string; slug: string; brands: Array<{ id: string; name: string; slug: string }> }> = [];

    const organisationId = progress.organisationId ?? workspace.preference.currentOrganisationId;
    const projectId = progress.projectId ?? workspace.preference.currentProjectId;
    const brandId = progress.brandId ?? workspace.preference.currentBrandId;

    if (organisationId) {
      organisation = await prisma.organisation.findUnique({ where: { id: organisationId } });
      templateProjects = await prisma.project.findMany({
        where: { organisationId, archivedAt: null, status: { not: "ARCHIVED" } },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          brands: {
            where: { archivedAt: null, status: { not: "ARCHIVED" } },
            orderBy: { name: "asc" },
            select: { id: true, name: true, slug: true },
          },
        },
      });
    }

    if (organisationId && projectId) {
      project = await prisma.project.findFirst({ where: { id: projectId, organisationId } });
    }

    if (organisationId && projectId && brandId) {
      brand = await prisma.brand.findFirst({
        where: { id: brandId, organisationId, projectId },
      });
      brandProfile = await prisma.brandProfile.findUnique({ where: { brandId } });
      objectives = await prisma.marketingObjective.findMany({
        where: { brandId, organisationId },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      });
      channelPreferences = await prisma.brandChannelPreference.findMany({
        where: { brandId, organisationId, enabled: true },
        orderBy: { channel: "asc" },
      });
    }

    return {
      progress,
      profile,
      organisation,
      project,
      brand,
      brandProfile,
      objectives,
      channelPreferences,
      templateProjects,
      workspace: workspace.preference,
      template: progress.templateKey ? getOnboardingTemplate(progress.templateKey) : null,
    };
  },

  async saveAccountProfile(userProfileId: string, input: AccountProfileInput, requestId?: string) {
    await prisma.userProfile.update({
      where: { id: userProfileId },
      data: {
        displayName: input.displayName || undefined,
        firstName: input.firstName || undefined,
        lastName: input.lastName || undefined,
        timezone: input.timezone || undefined,
        locale: input.locale || undefined,
      },
    });

    const nextStep = getNextOnboardingStep(OnboardingStepKey.ACCOUNT_PROFILE)!;
    const progress = await markStepComplete(
      userProfileId,
      OnboardingStepKey.ACCOUNT_PROFILE,
      nextStep,
      {
        stepData: input as Prisma.InputJsonValue,
      },
    );

    await workspaceService.updateWorkspace(userProfileId, {
      onboardingStep: nextStep,
    }, requestId);

    return progress;
  },

  async saveOrganisation(userProfileId: string, input: OrganisationInput, requestId?: string) {
    const progress = await ensureProgress(userProfileId);
    let organisationId = progress.organisationId;

    if (organisationId) {
      const tenant = await buildTenantContextForUser(userProfileId, { organisationId });
      await organisationService.update(
        organisationId,
        {
          name: input.name,
          legalName: input.legalName || null,
          website: input.website || null,
          industry: input.industry || null,
          countryCode: input.countryCode || null,
          defaultTimezone: input.defaultTimezone || "UTC",
        },
        tenant,
        requestId,
      );
    } else {
      const organisation = await organisationService.create(
        {
          name: input.name,
          slug: input.slug || slugFromName(input.name),
          legalName: input.legalName,
          website: input.website,
          industry: input.industry,
          countryCode: input.countryCode,
          defaultTimezone: input.defaultTimezone,
        },
        userProfileId,
        requestId,
      );
      organisationId = organisation.id;
    }

    const nextStep = getNextOnboardingStep(OnboardingStepKey.ORGANISATION)!;
    const updated = await markStepComplete(
      userProfileId,
      OnboardingStepKey.ORGANISATION,
      nextStep,
      {
        organisationId,
        stepData: {
          ...(progress.stepData as Record<string, unknown> | null),
          organisation: input,
        } as Prisma.InputJsonValue,
      },
    );

    await workspaceService.updateWorkspace(userProfileId, {
      currentOrganisationId: organisationId,
      onboardingStep: nextStep,
    }, requestId);

    return updated;
  },

  async saveProject(userProfileId: string, input: ProjectInput, requestId?: string) {
    const progress = await ensureProgress(userProfileId);
    const organisationId = progress.organisationId;

    if (!organisationId) {
      throw new AppError("VALIDATION_ERROR", "Create an organisation before adding a project.");
    }

    await assertOnboardingScope(userProfileId, organisationId);

    let projectId = input.existingProjectId ?? progress.projectId;
    const tenant = await buildTenantContextForUser(userProfileId, { organisationId });

    if (projectId) {
      await projectService.update(
        projectId,
        organisationId,
        {
          name: input.name,
          description: input.description || null,
          website: input.website || null,
        },
        tenant,
        requestId,
      );
    } else {
      const project = await projectService.create(
        organisationId,
        {
          name: input.name,
          slug: input.slug || slugFromName(input.name),
          description: input.description,
          website: input.website,
        },
        tenant,
        requestId,
      );
      projectId = project.id;
    }

    const nextStep = getNextOnboardingStep(OnboardingStepKey.PROJECT)!;
    const updated = await markStepComplete(userProfileId, OnboardingStepKey.PROJECT, nextStep, {
      projectId,
      stepData: {
        ...(progress.stepData as Record<string, unknown> | null),
        project: input,
      } as Prisma.InputJsonValue,
    });

    await workspaceService.updateWorkspace(userProfileId, {
      currentOrganisationId: organisationId,
      currentProjectId: projectId,
      onboardingStep: nextStep,
    }, requestId);

    return updated;
  },

  async saveBrand(userProfileId: string, input: BrandInput, requestId?: string) {
    const progress = await ensureProgress(userProfileId);
    const organisationId = progress.organisationId;
    const projectId = input.existingProjectId ?? progress.projectId;

    if (!organisationId || !projectId) {
      throw new AppError("VALIDATION_ERROR", "Create a project before adding a brand.");
    }

    await assertOnboardingScope(userProfileId, organisationId, projectId);

    let brandId = input.existingBrandId ?? progress.brandId;
    const tenant = await buildTenantContextForUser(userProfileId, {
      organisationId,
      projectId,
    });

    if (brandId) {
      await brandService.update(
        brandId,
        organisationId,
        {
          name: input.name,
          description: input.description || null,
          website: input.website || null,
        },
        tenant,
        requestId,
      );
    } else {
      const brand = await brandService.create(
        organisationId,
        projectId,
        {
          name: input.name,
          slug: input.slug || slugFromName(input.name),
          description: input.description,
          website: input.website,
          status: BrandStatus.ACTIVE,
        },
        tenant,
        requestId,
      );
      brandId = brand.id;
    }

    const nextStep = getNextOnboardingStep(OnboardingStepKey.BRAND)!;
    const updated = await markStepComplete(userProfileId, OnboardingStepKey.BRAND, nextStep, {
      brandId,
      stepData: {
        ...(progress.stepData as Record<string, unknown> | null),
        brand: input,
      } as Prisma.InputJsonValue,
    });

    await workspaceService.updateWorkspace(userProfileId, {
      currentOrganisationId: organisationId,
      currentProjectId: projectId,
      currentBrandId: brandId,
      onboardingStep: nextStep,
    }, requestId);

    return updated;
  },

  async saveBrandProfile(userProfileId: string, input: BrandProfileInput, requestId?: string) {
    const progress = await ensureProgress(userProfileId);
    const { organisationId, projectId, brandId } = progress;

    if (!organisationId || !projectId || !brandId) {
      throw new AppError("VALIDATION_ERROR", "Create a brand before saving its profile.");
    }

    await assertOnboardingScope(userProfileId, organisationId, projectId, brandId);

    const tenant = await buildTenantContextForUser(userProfileId, {
      organisationId,
      projectId,
      brandId,
    });

    await brandProfileService.upsert(
      brandId,
      organisationId,
      {
        shortDescription: input.shortDescription || null,
        targetAudience: input.targetAudience || null,
        valueProposition: input.valueProposition || null,
        longDescription: input.longDescription || null,
        mission: input.mission || null,
      },
      tenant,
      requestId,
    );

    const nextStep = getNextOnboardingStep(OnboardingStepKey.BRAND_PROFILE)!;
    const updated = await markStepComplete(
      userProfileId,
      OnboardingStepKey.BRAND_PROFILE,
      nextStep,
      {
        stepData: {
          ...(progress.stepData as Record<string, unknown> | null),
          brandProfile: input,
        } as Prisma.InputJsonValue,
      },
    );

    await workspaceService.updateWorkspace(userProfileId, { onboardingStep: nextStep }, requestId);
    return updated;
  },

  async saveMarketingObjectives(
    userProfileId: string,
    input: MarketingObjectivesInput,
    requestId?: string,
  ) {
    const progress = await ensureProgress(userProfileId);
    const { organisationId, projectId, brandId } = progress;

    if (!organisationId || !projectId || !brandId) {
      throw new AppError("VALIDATION_ERROR", "Create a brand before adding marketing objectives.");
    }

    await assertOnboardingScope(userProfileId, organisationId, projectId, brandId);

    await prisma.$transaction(async (tx) => {
      const submittedTypes = input.objectives.map((objective) => objective.objectiveType);

      await tx.marketingObjective.deleteMany({
        where: {
          brandId,
          objectiveType: { notIn: submittedTypes },
        },
      });

      for (const objective of input.objectives) {
        await tx.marketingObjective.upsert({
          where: {
            brandId_objectiveType: {
              brandId,
              objectiveType: objective.objectiveType,
            },
          },
          update: {
            description: objective.description,
            priority: objective.priority,
            targetValue: objective.targetValue,
            targetPeriod: objective.targetPeriod,
            status: MarketingObjectiveStatus.PLANNED,
          },
          create: {
            organisationId,
            projectId,
            brandId,
            objectiveType: objective.objectiveType,
            description: objective.description,
            priority: objective.priority,
            targetValue: objective.targetValue,
            targetPeriod: objective.targetPeriod,
            status: MarketingObjectiveStatus.PLANNED,
          },
        });
      }

      await recordAuditEvent(
        {
          organisationId,
          projectId,
          actorUserId: userProfileId,
          action: "onboarding.objectivesSaved",
          resourceType: "marketing_objective",
          resourceId: brandId,
          requestId,
          metadata: { count: input.objectives.length },
        },
        tx,
      );
    });

    const nextStep = getNextOnboardingStep(OnboardingStepKey.MARKETING_OBJECTIVES)!;
    const updated = await markStepComplete(
      userProfileId,
      OnboardingStepKey.MARKETING_OBJECTIVES,
      nextStep,
      {
        stepData: {
          ...(progress.stepData as Record<string, unknown> | null),
          objectives: input.objectives,
        } as Prisma.InputJsonValue,
      },
    );

    await workspaceService.updateWorkspace(userProfileId, { onboardingStep: nextStep }, requestId);
    return updated;
  },

  async saveChannelPreferences(
    userProfileId: string,
    input: ChannelPreferencesInput,
    requestId?: string,
  ) {
    const progress = await ensureProgress(userProfileId);
    const { organisationId, projectId, brandId } = progress;

    if (!organisationId || !projectId || !brandId) {
      throw new AppError("VALIDATION_ERROR", "Create a brand before selecting channels.");
    }

    await assertOnboardingScope(userProfileId, organisationId, projectId, brandId);

    await prisma.$transaction(async (tx) => {
      await tx.brandChannelPreference.deleteMany({
        where: {
          brandId,
          channel: { notIn: input.channels },
        },
      });

      for (const channel of input.channels) {
        await tx.brandChannelPreference.upsert({
          where: {
            brandId_channel: { brandId, channel },
          },
          update: { enabled: true },
          create: {
            organisationId,
            projectId,
            brandId,
            channel,
            enabled: true,
          },
        });
      }

      await recordAuditEvent(
        {
          organisationId,
          projectId,
          actorUserId: userProfileId,
          action: "onboarding.channelsSaved",
          resourceType: "brand_channel_preference",
          resourceId: brandId,
          requestId,
          metadata: { channels: input.channels },
        },
        tx,
      );
    });

    const nextStep = getNextOnboardingStep(OnboardingStepKey.CHANNEL_PREFERENCES)!;
    const updated = await markStepComplete(
      userProfileId,
      OnboardingStepKey.CHANNEL_PREFERENCES,
      nextStep,
      {
        stepData: {
          ...(progress.stepData as Record<string, unknown> | null),
          channels: input.channels,
        } as Prisma.InputJsonValue,
      },
    );

    await workspaceService.updateWorkspace(userProfileId, { onboardingStep: nextStep }, requestId);
    return updated;
  },

  async complete(userProfileId: string, requestId?: string) {
    const progress = await ensureProgress(userProfileId);
    const { organisationId, projectId, brandId } = progress;

    if (!organisationId || !projectId || !brandId) {
      throw new AppError("VALIDATION_ERROR", "Complete all required onboarding steps first.");
    }

    await assertOnboardingScope(userProfileId, organisationId, projectId, brandId);

    const updated = await prisma.onboardingProgress.update({
      where: { userId: userProfileId },
      data: {
        completedSteps: ONBOARDING_STEPS,
        currentStep: OnboardingStepKey.REVIEW,
        completedAt: new Date(),
      },
    });

    await workspaceService.updateWorkspace(
      userProfileId,
      {
        currentOrganisationId: organisationId,
        currentProjectId: projectId,
        currentBrandId: brandId,
        completeOnboarding: true,
        onboardingStep: null,
      },
      requestId,
    );

    await recordAuditEvent({
      organisationId,
      projectId,
      actorUserId: userProfileId,
      action: "onboarding.completed",
      resourceType: "onboarding_progress",
      resourceId: updated.id,
      requestId,
      metadata: { templateKey: progress.templateKey },
    });

    return updated;
  },

  async goBack(userProfileId: string, fromStep: OnboardingStepKey, requestId?: string) {
    const previous = getPreviousOnboardingStep(fromStep);
    if (!previous) {
      throw new AppError("VALIDATION_ERROR", "This is the first onboarding step.");
    }

    const progress = await prisma.onboardingProgress.update({
      where: { userId: userProfileId },
      data: { currentStep: previous },
    });

    await workspaceService.updateWorkspace(userProfileId, { onboardingStep: previous }, requestId);
    return progress;
  },

  async applyCrescoTemplate(userProfileId: string, requestId?: string) {
    const template = CRESCO_INTERNAL_TEMPLATE;
    const progress = await ensureProgress(userProfileId);

    if (progress.organisationId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "A workspace already exists for this onboarding session. Continue with your current setup.",
      );
    }

    const existingOrganisation = await prisma.organisation.findUnique({
      where: { slug: template.organisation.slug },
    });

    if (existingOrganisation) {
      throw new AppError(
        "VALIDATION_ERROR",
        "The Cresco internal organisation already exists. Contact an administrator for access.",
      );
    }

    const organisation = await organisationService.create(
      {
        name: template.organisation.name,
        slug: template.organisation.slug,
        industry: template.organisation.industry,
        defaultTimezone: template.organisation.defaultTimezone,
      },
      userProfileId,
      requestId,
    );

    return prisma.$transaction(async (tx) => {
      const createdProjects: Array<{ projectId: string; brandId: string }> = [];

      for (const templateProject of template.projects) {
        const project = await tx.project.create({
          data: {
            organisationId: organisation.id,
            name: templateProject.name,
            slug: templateProject.slug,
            description: templateProject.description ?? null,
            status: ProjectStatus.ACTIVE,
            createdByUserId: userProfileId,
          },
        });

        const brand = await tx.brand.create({
          data: {
            organisationId: organisation.id,
            projectId: project.id,
            name: templateProject.brandName,
            slug: templateProject.brandSlug,
            description: templateProject.description ?? null,
            status: BrandStatus.ACTIVE,
            createdByUserId: userProfileId,
            profile: { create: { organisationId: organisation.id, projectId: project.id } },
          },
        });

        createdProjects.push({ projectId: project.id, brandId: brand.id });
      }

      const first = createdProjects[0]!;

      const updatedProgress = await tx.onboardingProgress.update({
        where: { userId: userProfileId },
        data: {
          templateKey: template.key,
          organisationId: organisation.id,
          projectId: first.projectId,
          brandId: first.brandId,
          currentStep: OnboardingStepKey.BRAND_PROFILE,
          completedSteps: [
            OnboardingStepKey.ACCOUNT_PROFILE,
            OnboardingStepKey.ORGANISATION,
            OnboardingStepKey.PROJECT,
            OnboardingStepKey.BRAND,
          ],
          stepData: {
            template: template.key,
            organisation: template.organisation,
            projects: template.projects,
          },
        },
      });

      await tx.workspacePreference.upsert({
        where: { userId: userProfileId },
        update: {
          currentOrganisationId: organisation.id,
          currentProjectId: first.projectId,
          currentBrandId: first.brandId,
          onboardingStep: OnboardingStepKey.BRAND_PROFILE,
        },
        create: {
          userId: userProfileId,
          currentOrganisationId: organisation.id,
          currentProjectId: first.projectId,
          currentBrandId: first.brandId,
          onboardingStep: OnboardingStepKey.BRAND_PROFILE,
        },
      });

      await recordAuditEvent(
        {
          organisationId: organisation.id,
          actorUserId: userProfileId,
          action: "onboarding.templateApplied",
          resourceType: "onboarding_progress",
          resourceId: updatedProgress.id,
          requestId,
          metadata: { templateKey: template.key },
        },
        tx,
      );

      return updatedProgress;
    });
  },

  async switchWorkspaceContext(
    userProfileId: string,
    input: { currentProjectId: string; currentBrandId: string },
    requestId?: string,
  ) {
    const progress = await ensureProgress(userProfileId);
    const organisationId = progress.organisationId;

    if (!organisationId) {
      throw new AppError("VALIDATION_ERROR", "Organisation context is required.");
    }

    await assertOnboardingScope(
      userProfileId,
      organisationId,
      input.currentProjectId,
      input.currentBrandId,
    );

    const updated = await prisma.onboardingProgress.update({
      where: { userId: userProfileId },
      data: {
        projectId: input.currentProjectId,
        brandId: input.currentBrandId,
      },
    });

    await workspaceService.updateWorkspace(
      userProfileId,
      {
        currentOrganisationId: organisationId,
        currentProjectId: input.currentProjectId,
        currentBrandId: input.currentBrandId,
      },
      requestId,
    );

    return updated;
  },

  getDefaultObjectiveDescription(objectiveType: keyof typeof MARKETING_OBJECTIVE_LABELS): string {
    return `Increase ${MARKETING_OBJECTIVE_LABELS[objectiveType].toLowerCase()} for this brand.`;
  },
};
