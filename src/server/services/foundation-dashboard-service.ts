import { prisma } from "@/lib/database/prisma";
import { getIntegrationStatus, getServerEnv } from "@/lib/environment";
import { listConfiguredProviders } from "@/lib/ai/providers";
import {
  calculateFoundationReadiness,
  isBrandProfileReady,
  type FoundationReadinessItem,
} from "@/lib/foundation/readiness";
import {
  generateFoundationNextActions,
  type FoundationNextAction,
} from "@/lib/foundation/next-actions";
import {
  formatAuditActivityLabel,
  isFoundationAuditAction,
} from "@/lib/foundation/activity";
import { connectorRegistry } from "@/lib/connectors/registry";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import { buildTenantContextForUser } from "@/lib/tenancy/guards";
import { calculateKnowledgeReadiness } from "@/lib/brand-knowledge/readiness";
import { MARKETING_OBJECTIVE_LABELS } from "@/lib/onboarding/marketing";
import { auditService } from "@/server/services/audit-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { workspaceService } from "@/server/services/workspace-service";

export type FoundationDashboardData = {
  workspace: {
    organisation: { id: string; name: string } | null;
    project: { id: string; name: string } | null;
    brand: { id: string; name: string } | null;
  };
  onboarding: {
    completed: boolean;
    currentStep: string | null;
    completedAt: string | null;
  };
  readiness: FoundationReadinessItem[];
  nextActions: FoundationNextAction[];
  metrics: {
    connectedChannelCount: number;
    marketingObjectiveCount: number;
    marketingAssetCount: number;
    approvedMarketingAssetCount: number;
    knowledgeOverallScore: number | null;
  };
  marketingObjectives: Array<{
    id: string;
    label: string;
    priority: number;
    status: string;
  }>;
  recentActivity: Array<{
    id: string;
    label: string;
    action: string;
    resourceType: string;
    createdAt: string;
  }>;
  canViewAuditActivity: boolean;
  aiSummary: {
    configuredProviders: number;
    totalProviders: number;
    integrationsConfigured: number;
  };
};

export const foundationDashboardService = {
  async getDashboard(userProfileId: string): Promise<FoundationDashboardData> {
    const workspace = await workspaceService.getResolvedWorkspace(userProfileId);
    const organisation = workspace.organisations.find(
      (item) => item.id === workspace.preference.currentOrganisationId,
    );
    const project = workspace.projects.find(
      (item) => item.id === workspace.preference.currentProjectId,
    );
    const brand = workspace.brands.find((item) => item.id === workspace.preference.currentBrandId);

    const organisationId = workspace.preference.currentOrganisationId;
    const brandId = workspace.preference.currentBrandId;

    let tenant = null;
    if (organisationId) {
      tenant = await buildTenantContextForUser(userProfileId, {
        organisationId,
        projectId: workspace.preference.currentProjectId ?? undefined,
        brandId: brandId ?? undefined,
      });
    }

    const [brandProfile, objectives, marketingAssets, connectorAccounts, knowledgeSnapshot] =
      await Promise.all([
        brandId
          ? prisma.brandProfile.findUnique({ where: { brandId } })
          : Promise.resolve(null),
        brandId
          ? prisma.marketingObjective.findMany({
              where: { brandId },
              orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
            })
          : Promise.resolve([]),
        brandId
          ? prisma.marketingAsset.findMany({
              where: {
                brandId,
                archivedAt: null,
                status: { not: "ARCHIVED" },
              },
              select: {
                id: true,
                approvedForMarketing: true,
                assetType: true,
              },
            })
          : Promise.resolve([]),
        brandId && organisationId
          ? prisma.connectorAccount.findMany({
              where: {
                organisationId,
                brandId,
              },
              select: {
                status: true,
                connectorType: true,
              },
            })
          : Promise.resolve([]),
        brandId && organisationId && tenant
          ? brandKnowledgeService.getSnapshot(brandId, organisationId, tenant)
          : Promise.resolve(null),
      ]);

    const knowledgeReadiness = knowledgeSnapshot
      ? calculateKnowledgeReadiness(knowledgeSnapshot)
      : null;

    const hasLogo = Boolean(
      knowledgeSnapshot?.brand.logoUrl?.trim() ||
        marketingAssets.some((asset) => asset.assetType === "IMAGE"),
    );

    const hasApprovedCta = Boolean(
      knowledgeSnapshot?.messaging?.ctaLibrary?.some((cta) => cta.trim().length > 0),
    );

    const aiProviders = listConfiguredProviders();
    const integrationStatus = getIntegrationStatus(getServerEnv());
    const aiProvidersConfigured = aiProviders.filter((provider) => provider.configured).length;
    const aiProvidersTotal = aiProviders.length;

    const availableConnectorCount = connectorRegistry
      .list()
      .filter((entry) => entry.platformAvailability === "AVAILABLE").length;
    const connectedConnectorCount = connectorAccounts.filter(
      (account) => account.status === "CONNECTED",
    ).length;

    const readiness = calculateFoundationReadiness({
      hasOrganisation: Boolean(organisation),
      hasProject: Boolean(project),
      hasBrand: Boolean(brand),
      onboardingCompleted: Boolean(workspace.preference.onboardingCompletedAt),
      brandProfileComplete: isBrandProfileReady(brandProfile),
      knowledgeReadiness,
      marketingAssetCount: marketingAssets.length,
      approvedMarketingAssetCount: marketingAssets.filter((asset) => asset.approvedForMarketing)
        .length,
      hasLogo,
      connectedConnectorCount,
      availableConnectorCount,
      aiProvidersConfigured,
      aiProvidersTotal,
      marketingObjectiveCount: objectives.length,
    });

    const nextActions = generateFoundationNextActions({
      readiness,
      hasBrand: Boolean(brand),
      brandId: brand?.id ?? null,
      onboardingCompleted: Boolean(workspace.preference.onboardingCompletedAt),
      hasLogo,
      hasApprovedCta,
      aiProvidersConfigured,
      connectedConnectorCount,
      availableConnectorCount,
    });

    const canViewAuditActivity = tenant
      ? hasPermission(tenant.organisationRole, PERMISSIONS["auditLogs.read"])
      : false;

    const recentActivity =
      organisationId && canViewAuditActivity
        ? (await auditService.list(organisationId, 12))
            .filter((event) => isFoundationAuditAction(event.action))
            .slice(0, 8)
            .map((event) => ({
              id: event.id,
              label: formatAuditActivityLabel(event.action, event.resourceType),
              action: event.action,
              resourceType: event.resourceType,
              createdAt: event.createdAt.toISOString(),
            }))
        : [];

    return {
      workspace: {
        organisation: organisation ? { id: organisation.id, name: organisation.name } : null,
        project: project ? { id: project.id, name: project.name } : null,
        brand: brand ? { id: brand.id, name: brand.name } : null,
      },
      onboarding: {
        completed: Boolean(workspace.preference.onboardingCompletedAt),
        currentStep: workspace.preference.onboardingStep,
        completedAt: workspace.preference.onboardingCompletedAt?.toISOString() ?? null,
      },
      readiness,
      nextActions,
      metrics: {
        connectedChannelCount: connectedConnectorCount,
        marketingObjectiveCount: objectives.length,
        marketingAssetCount: marketingAssets.length,
        approvedMarketingAssetCount: marketingAssets.filter((asset) => asset.approvedForMarketing)
          .length,
        knowledgeOverallScore: knowledgeReadiness?.overallScore ?? null,
      },
      marketingObjectives: objectives.map((objective) => ({
        id: objective.id,
        label: MARKETING_OBJECTIVE_LABELS[objective.objectiveType],
        priority: objective.priority,
        status: objective.status,
      })),
      recentActivity,
      canViewAuditActivity,
      aiSummary: {
        configuredProviders: aiProvidersConfigured,
        totalProviders: aiProvidersTotal,
        integrationsConfigured: Object.values(integrationStatus).filter((item) => item.configured)
          .length,
      },
    };
  },
};
