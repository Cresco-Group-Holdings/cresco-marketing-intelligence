import {
  BrandMarketingChannel,
  GrowthRecommendationStatus,
  MarketingAnalystRecommendationStatus,
  OrganisationRole,
  ProviderConnectionStatus,
  ProviderSyncRunStatus,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import {
  evaluateEssentialBrandKnowledge,
  evaluateRecommendedBrandKnowledge,
} from "@/lib/activation/brand-knowledge-essential";
import { buildActivationChecklist } from "@/lib/activation/checklist";
import { DEMO_WORKSPACE_LABEL } from "@/lib/activation/demo";
import {
  activationAuditAction,
  type ActivationEventName,
} from "@/lib/activation/events";
import { createEmptyMilestoneSnapshot } from "@/lib/activation/status";
import { calculateActivationStatus } from "@/lib/activation/status";
import { resolveActivationNextAction } from "@/lib/activation/next-action";
import { recommendProviders, type ActivationGoal } from "@/lib/activation/providers";
import {
  IDEMPOTENT_ACTIVATION_EVENTS,
  isClientDomainAssertingEvent,
} from "@/lib/activation/truth";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import { buildTenantContextForUser } from "@/lib/tenancy/guards";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logging";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { recordAuditEvent } from "@/server/services/audit-service";
import { workspaceService } from "@/server/services/workspace-service";
import type { ActivationProviderRecommendation } from "@/lib/activation/providers";
import type { ActivationChecklist } from "@/lib/activation/checklist";
import type { ActivationNextAction } from "@/lib/activation/next-action";
import type { ActivationHighLevelStatus } from "@/lib/activation/milestones";
import type { BrandKnowledgeTierResult } from "@/lib/activation/brand-knowledge-essential";

export type ActivationPreferences = {
  goal: ActivationGoal | null;
  persona: string | null;
  channels: BrandMarketingChannel[];
};

export type ActivationState = {
  status: ActivationHighLevelStatus;
  isActivated: boolean;
  demoProductExperienced: boolean;
  readyForFirstValue: boolean;
  essentialCompleted: number;
  essentialTotal: number;
  demoModeEnabled: boolean;
  demoLabel: string | null;
  invitedMember: boolean;
  onboardingCompleted: boolean;
  syncInProgress: boolean;
  preferences: ActivationPreferences;
  brandKnowledge: {
    essential: BrandKnowledgeTierResult;
    recommended: BrandKnowledgeTierResult;
  } | null;
  checklist: ActivationChecklist;
  nextAction: ActivationNextAction | null;
  providerRecommendations: {
    recommended: ActivationProviderRecommendation[];
    optional: ActivationProviderRecommendation[];
  };
  workspace: {
    organisation: { id: string; name: string } | null;
    project: { id: string; name: string } | null;
    brand: { id: string; name: string } | null;
  };
  degradedSources: string[];
};

type ActivationStepData = {
  activationGoal?: ActivationGoal;
  onboardingPersona?: string;
  marketingChannels?: BrandMarketingChannel[];
  demoModeEnabled?: boolean;
};

function parseStepData(stepData: unknown): ActivationStepData {
  if (!stepData || typeof stepData !== "object") {
    return {};
  }

  return stepData as ActivationStepData;
}

async function hasInvitedMembership(userProfileId: string): Promise<boolean> {
  const acceptedInvitation = await prisma.invitation.findFirst({
    where: {
      acceptedByUserId: userProfileId,
      status: "ACCEPTED",
    },
    select: { id: true },
  });

  return Boolean(acceptedInvitation);
}

async function hasCanonicalInsight(
  organisationId: string,
  brandId: string,
): Promise<boolean> {
  const [growthRecommendation, analystRecommendation] = await Promise.all([
    prisma.growthRecommendation.findFirst({
      where: {
        organisationId,
        brandId,
        status: GrowthRecommendationStatus.ACTIVE,
      },
      select: { id: true },
    }),
    prisma.marketingAnalystRecommendation.findFirst({
      where: {
        organisationId,
        brandId,
        status: MarketingAnalystRecommendationStatus.OPEN,
      },
      select: { id: true },
    }),
  ]);

  return Boolean(growthRecommendation ?? analystRecommendation);
}

async function safeCountAnalyticsObservations(
  organisationId: string,
  brandId: string,
): Promise<number> {
  try {
    return await prisma.marketingMetricObservation.count({
      where: { organisationId, brandId },
      take: 1,
    });
  } catch {
    return 0;
  }
}

async function safeHasCanonicalInsight(
  organisationId: string,
  brandId: string,
): Promise<boolean> {
  try {
    return await hasCanonicalInsight(organisationId, brandId);
  } catch {
    return false;
  }
}

async function safeHasInvitedMembership(userProfileId: string): Promise<boolean> {
  try {
    return await hasInvitedMembership(userProfileId);
  } catch {
    return false;
  }
}

async function safeQuery<T>(
  source: string,
  query: () => Promise<T>,
  fallback: T,
  degradedSources?: string[],
): Promise<T> {
  try {
    return await query();
  } catch (error) {
    logger.warn("activation.query_failed", {
      source,
      error: error instanceof Error ? error.message : String(error),
    });
    degradedSources?.push(source);
    return fallback;
  }
}

export const activationService = {
  async getState(userProfileId: string): Promise<ActivationState> {
    const degradedSources: string[] = [];

    let workspace: Awaited<ReturnType<typeof workspaceService.getResolvedWorkspace>>;
    try {
      workspace = await workspaceService.getResolvedWorkspace(userProfileId);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error("activation.workspace_resolution_failed", {
        userProfileId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    const progress = await safeQuery(
      "onboardingProgress",
      () =>
        prisma.onboardingProgress.findUnique({
          where: { userId: userProfileId },
        }),
      null,
      degradedSources,
    );
    const stepData = parseStepData(progress?.stepData);
    const demoModeEnabled = stepData.demoModeEnabled ?? false;

    const organisation = workspace.organisations.find(
      (item) => item.id === workspace.preference.currentOrganisationId,
    );
    const project = workspace.projects.find(
      (item) => item.id === workspace.preference.currentProjectId,
    );
    const brand = workspace.brands.find((item) => item.id === workspace.preference.currentBrandId);

    const organisationId = organisation?.id ?? null;
    const projectId = project?.id ?? null;
    const brandId = brand?.id ?? null;
    const onboardingCompleted = Boolean(workspace.preference.onboardingCompletedAt);

    let tenant = null;
    if (organisationId) {
      try {
        tenant = await buildTenantContextForUser(userProfileId, {
          organisationId,
          projectId: projectId ?? undefined,
          brandId: brandId ?? undefined,
        });
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }

        logger.warn("activation.tenant_context_failed", {
          organisationId,
          projectId,
          brandId,
          error: error instanceof Error ? error.message : String(error),
        });
        degradedSources.push("tenantContext");
      }
    }

    const canManageIntegrations = tenant
      ? hasPermission(tenant.organisationRole, PERMISSIONS["providerConnections.create"])
      : false;

    const invitedMember = await safeHasInvitedMembership(userProfileId);

    const [
      knowledgeSnapshot,
      contentCount,
      aiContentCount,
      variantCount,
      approvedContentCount,
      publicationCount,
      providerConnections,
      syncRuns,
      completedSync,
      analyticsObservationCount,
      hasInsight,
      recommendationViewEvent,
      demoEnteredEvent,
      activationCompleteEvent,
    ] = await Promise.all([
      brandId && organisationId && tenant
        ? brandKnowledgeService
            .getSnapshot(brandId, organisationId, tenant)
            .catch((error) => {
              logger.warn("activation.brand_knowledge_failed", {
                brandId,
                organisationId,
                error: error instanceof Error ? error.message : String(error),
              });
              degradedSources.push("brandKnowledge");
              return null;
            })
        : Promise.resolve(null),
      brandId && organisationId
        ? safeQuery(
            "contentItem",
            () => prisma.contentItem.count({ where: { brandId, organisationId } }),
            0,
            degradedSources,
          )
        : Promise.resolve(0),
      brandId && organisationId
        ? safeQuery(
            "contentProvenance",
            () =>
              prisma.contentProvenance.count({
                where: {
                  brandId,
                  organisationId,
                },
              }),
            0,
            degradedSources,
          )
        : Promise.resolve(0),
      brandId && organisationId
        ? safeQuery(
            "contentVariant",
            () => prisma.contentVariant.count({ where: { brandId, organisationId } }),
            0,
            degradedSources,
          )
        : Promise.resolve(0),
      brandId && organisationId
        ? safeQuery(
            "contentApproval",
            () =>
              prisma.contentApproval.count({
                where: {
                  brandId,
                  organisationId,
                  decision: "APPROVED",
                },
              }),
            0,
            degradedSources,
          )
        : Promise.resolve(0),
      brandId && organisationId
        ? safeQuery(
            "publication",
            () =>
              prisma.publication.count({
                where: {
                  brandId,
                  organisationId,
                  status: { in: ["SCHEDULED", "PUBLISHED", "PUBLISHING"] },
                },
              }),
            0,
            degradedSources,
          )
        : Promise.resolve(0),
      organisationId
        ? safeQuery(
            "providerConnection",
            () =>
              prisma.providerConnection.findMany({
                where: {
                  organisationId,
                  status: {
                    in: [ProviderConnectionStatus.CONNECTED, ProviderConnectionStatus.RECONNECTED],
                  },
                },
                select: { providerKey: true, status: true },
              }),
            [],
            degradedSources,
          )
        : Promise.resolve([]),
      organisationId
        ? safeQuery(
            "providerSyncRun.active",
            () =>
              prisma.providerSyncRun.findMany({
                where: {
                  connection: { organisationId },
                  status: { in: [ProviderSyncRunStatus.RUNNING, ProviderSyncRunStatus.QUEUED] },
                },
                take: 1,
                select: { id: true },
              }),
            [],
            degradedSources,
          )
        : Promise.resolve([]),
      organisationId
        ? safeQuery(
            "providerSyncRun.completed",
            () =>
              prisma.providerSyncRun.findFirst({
                where: {
                  connection: { organisationId },
                  status: ProviderSyncRunStatus.SUCCEEDED,
                },
                select: { id: true },
              }),
            null,
            degradedSources,
          )
        : Promise.resolve(null),
      organisationId && brandId
        ? safeCountAnalyticsObservations(organisationId, brandId)
        : Promise.resolve(0),
      organisationId && brandId
        ? safeHasCanonicalInsight(organisationId, brandId)
        : Promise.resolve(false),
      organisationId
        ? safeQuery(
            "auditLog.recommendationView",
            () =>
              prisma.auditLog.findFirst({
                where: {
                  organisationId,
                  action: activationAuditAction("first_recommendation_view"),
                },
                select: { id: true },
              }),
            null,
            degradedSources,
          )
        : Promise.resolve(null),
      organisationId
        ? safeQuery(
            "auditLog.demoEntered",
            () =>
              prisma.auditLog.findFirst({
                where: {
                  organisationId,
                  action: activationAuditAction("demo_workspace_entered"),
                },
                select: { id: true },
              }),
            null,
            degradedSources,
          )
        : Promise.resolve(null),
      organisationId
        ? safeQuery(
            "auditLog.activationComplete",
            () =>
              prisma.auditLog.findFirst({
                where: {
                  organisationId,
                  action: activationAuditAction("activation_complete"),
                },
                select: { id: true },
              }),
            null,
            degradedSources,
          )
        : Promise.resolve(null),
    ]);

    const essentialKnowledge = evaluateEssentialBrandKnowledge(knowledgeSnapshot);
    const recommendedKnowledge = evaluateRecommendedBrandKnowledge(knowledgeSnapshot);

    const connectedProviderKeys = providerConnections.map((connection) => connection.providerKey);
    const workspaceProviderConnected = connectedProviderKeys.length > 0;
    const syncInProgress = syncRuns.length > 0;
    const demoProductExperienced = Boolean(demoEnteredEvent);

    const milestones = createEmptyMilestoneSnapshot();
    milestones.account_ready = true;
    milestones.organisation_ready = Boolean(organisation);
    milestones.project_ready = Boolean(project);
    milestones.brand_ready = Boolean(brand);
    milestones.minimum_brand_knowledge = essentialKnowledge.complete;
    milestones.first_provider_connected = workspaceProviderConnected;
    milestones.initial_sync_complete = Boolean(completedSync);
    milestones.first_content_created = contentCount > 0;
    milestones.first_ai_generation_completed = aiContentCount > 0;
    milestones.first_variant_created = variantCount > 0;
    milestones.first_approval_completed = approvedContentCount > 0;
    milestones.first_publication_scheduled = publicationCount > 0;
    milestones.first_analytics_observation = analyticsObservationCount > 0;
    milestones.first_recommendation_generated = hasInsight;
    milestones.first_recommendation_viewed = Boolean(recommendationViewEvent);

    const activationStatus = calculateActivationStatus({
      milestones,
      demoModeEnabled,
      demoProductExperienced,
      onboardingCompleted,
      syncInProgress,
    });

    if (activationStatus.isActivated && organisationId && !activationCompleteEvent) {
      void recordAuditEvent({
        organisationId,
        projectId: projectId ?? undefined,
        actorUserId: userProfileId,
        action: activationAuditAction("activation_complete"),
        resourceType: "activation_event",
        metadata: { status: activationStatus.status },
      }).catch((error) => {
        logger.warn("activation.audit_write_failed", {
          organisationId,
          action: "activation_complete",
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    const preferences: ActivationPreferences = {
      goal: stepData.activationGoal ?? null,
      persona: stepData.onboardingPersona ?? null,
      channels: stepData.marketingChannels ?? [],
    };

    const providerRecommendations = recommendProviders({
      goal: preferences.goal,
      channels: preferences.channels,
      connectedProviderKeys,
    });

    const checklist = buildActivationChecklist({
      milestones: activationStatus.milestones,
      brandId,
      canManageIntegrations,
      demoModeEnabled,
      workspaceProviderConnected,
      syncInProgress,
    });

    const nextAction = resolveActivationNextAction({
      status: activationStatus.status,
      milestones: activationStatus.milestones,
      brandId,
      onboardingCompleted,
      demoModeEnabled,
      syncInProgress,
      canManageIntegrations,
      invitedMember,
      workspaceProviderConnected,
    });

    return {
      status: activationStatus.status,
      isActivated: activationStatus.isActivated,
      demoProductExperienced: activationStatus.demoProductExperienced,
      readyForFirstValue: activationStatus.readyForFirstValue,
      essentialCompleted: checklist.essentialCompleted,
      essentialTotal: checklist.essentialTotal,
      demoModeEnabled,
      demoLabel: demoModeEnabled ? DEMO_WORKSPACE_LABEL : null,
      invitedMember,
      onboardingCompleted,
      syncInProgress,
      preferences,
      brandKnowledge: knowledgeSnapshot
        ? {
            essential: essentialKnowledge,
            recommended: recommendedKnowledge,
          }
        : null,
      checklist,
      nextAction,
      providerRecommendations,
      workspace: {
        organisation: organisation ? { id: organisation.id, name: organisation.name } : null,
        project: project ? { id: project.id, name: project.name } : null,
        brand: brand ? { id: brand.id, name: brand.name } : null,
      },
      degradedSources,
    };
  },

  async savePreferences(
    userProfileId: string,
    input: Partial<ActivationPreferences>,
    requestId?: string,
  ) {
    const progress = await prisma.onboardingProgress.upsert({
      where: { userId: userProfileId },
      update: {},
      create: {
        userId: userProfileId,
      },
    });

    const current = parseStepData(progress.stepData);
    const nextStepData = {
      ...current,
      ...(input.goal !== undefined ? { activationGoal: input.goal } : {}),
      ...(input.persona !== undefined ? { onboardingPersona: input.persona } : {}),
      ...(input.channels !== undefined ? { marketingChannels: input.channels } : {}),
    };

    await prisma.onboardingProgress.update({
      where: { userId: userProfileId },
      data: {
        stepData: nextStepData,
      },
    });

    const workspace = await workspaceService.getResolvedWorkspace(userProfileId);
    if (workspace.preference.currentOrganisationId) {
      await recordAuditEvent({
        organisationId: workspace.preference.currentOrganisationId,
        actorUserId: userProfileId,
        action: activationAuditAction("onboarding_goal_selected"),
        resourceType: "activation_preferences",
        requestId,
        metadata: {
          goal: input.goal ?? null,
          persona: input.persona ?? null,
        },
      });
    }
  },

  async setDemoMode(userProfileId: string, enabled: boolean, requestId?: string) {
    const workspace = await workspaceService.getResolvedWorkspace(userProfileId);
    const progress = await prisma.onboardingProgress.upsert({
      where: { userId: userProfileId },
      update: {},
      create: { userId: userProfileId },
    });
    const current = parseStepData(progress.stepData);

    await prisma.onboardingProgress.update({
      where: { userId: userProfileId },
      data: {
        stepData: {
          ...current,
          demoModeEnabled: enabled,
        },
      },
    });

    if (workspace.preference.currentOrganisationId) {
      await recordAuditEvent({
        organisationId: workspace.preference.currentOrganisationId,
        actorUserId: userProfileId,
        action: activationAuditAction(enabled ? "demo_workspace_entered" : "demo_workspace_exited"),
        resourceType: "workspace_preference",
        requestId,
      });
    }
  },

  async recordEvent(
    userProfileId: string,
    event: ActivationEventName,
    metadata?: Record<string, string | number | boolean | null>,
    requestId?: string,
  ) {
    if (isClientDomainAssertingEvent(event)) {
      throw new AppError(
        "FORBIDDEN",
        `Activation event "${event}" cannot be recorded from the client. Domain milestones are derived from server state.`,
      );
    }

    const workspace = await workspaceService.getResolvedWorkspace(userProfileId);
    const organisationId = workspace.preference.currentOrganisationId;

    if (!organisationId) {
      return null;
    }

    if (IDEMPOTENT_ACTIVATION_EVENTS.includes(event)) {
      const existing = await prisma.auditLog.findFirst({
        where: {
          organisationId,
          action: activationAuditAction(event),
        },
        select: { id: true },
      });

      if (existing) {
        return existing;
      }
    }

    return recordAuditEvent({
      organisationId,
      projectId: workspace.preference.currentProjectId ?? undefined,
      actorUserId: userProfileId,
      action: activationAuditAction(event),
      resourceType: "activation_event",
      requestId,
      metadata,
    });
  },

  async completeInvitedMemberOnboarding(userProfileId: string, organisationId: string) {
    const workspace = await workspaceService.getResolvedWorkspace(userProfileId);
    const projects = workspace.projects;
    const brands = workspace.brands;

    await prisma.workspacePreference.upsert({
      where: { userId: userProfileId },
      update: {
        currentOrganisationId: organisationId,
        currentProjectId: projects[0]?.id ?? null,
        currentBrandId: brands[0]?.id ?? null,
        onboardingCompletedAt: new Date(),
      },
      create: {
        userId: userProfileId,
        currentOrganisationId: organisationId,
        currentProjectId: projects[0]?.id ?? null,
        currentBrandId: brands[0]?.id ?? null,
        onboardingCompletedAt: new Date(),
      },
    });

    await prisma.onboardingProgress.upsert({
      where: { userId: userProfileId },
      update: {
        organisationId,
        projectId: projects[0]?.id ?? null,
        brandId: brands[0]?.id ?? null,
        completedAt: new Date(),
      },
      create: {
        userId: userProfileId,
        organisationId,
        projectId: projects[0]?.id ?? null,
        brandId: brands[0]?.id ?? null,
        completedAt: new Date(),
      },
    });
  },

  async canManageIntegrations(userProfileId: string, organisationId: string | null): Promise<boolean> {
    if (!organisationId) {
      return false;
    }

    const tenant = await buildTenantContextForUser(userProfileId, { organisationId });
    return hasPermission(tenant.organisationRole, PERMISSIONS["providerConnections.create"]);
  },

  isOwnerOrAdmin(role: OrganisationRole): boolean {
    return role === OrganisationRole.OWNER || role === OrganisationRole.ADMIN;
  },
};
