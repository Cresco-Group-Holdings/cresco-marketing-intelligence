/**
 * Journey A — New Customer → First Insight
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GrowthRecommendationStatus,
  OrganisationRole,
  ProviderConnectionStatus,
} from "@prisma/client";
import { resetEnvCacheForTests } from "@/lib/environment";
import {
  buildStateDigest,
  encryptOAuthPayload,
  resolveOAuthCallbackUrl,
} from "@/lib/integrations/oauth/security";
import { createSignedOAuthStatePayload } from "@/lib/providers/oauth/state-signing";
import { finishJourneyMonitor, resetJourneyMonitor } from "../harness/journey-monitor";

const prismaMock = vi.hoisted(() => ({
  oAuthTransaction: { findUnique: vi.fn(), update: vi.fn() },
  providerConnection: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  providerConnectionAccount: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  providerSyncRun: { findFirst: vi.fn(), findMany: vi.fn() },
  marketingMetricObservation: { count: vi.fn() },
  growthRecommendation: { findFirst: vi.fn() },
  marketingAnalystRecommendation: { findFirst: vi.fn() },
  onboardingProgress: { findUnique: vi.fn() },
  invitation: { findFirst: vi.fn() },
  contentItem: { count: vi.fn() },
  contentProvenance: { count: vi.fn() },
  contentVariant: { count: vi.fn() },
  contentApproval: { count: vi.fn() },
  publication: { count: vi.fn() },
  auditLog: { findFirst: vi.fn() },
  advertisingCampaignPlan: { count: vi.fn() },
  socialExperiment: { count: vi.fn() },
  userProfile: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

const oauthAdapterMock = vi.hoisted(() => ({
  exchangeAuthorizationCode: vi.fn(),
  validateConnection: vi.fn(),
  discoverAccounts: vi.fn(),
}));

const credentialVaultMock = vi.hoisted(() => ({ store: vi.fn() }));
const workspaceService = vi.hoisted(() => ({ getResolvedWorkspace: vi.fn() }));
const brandKnowledgeService = vi.hoisted(() => ({ getSnapshot: vi.fn() }));
const buildTenantContextForUser = vi.hoisted(() => vi.fn());
const providerInitialSyncMock = vi.hoisted(() => ({
  triggerAfterAccountSelection: vi.fn().mockResolvedValue({ queued: true, syncRunId: "sync-ga4-1" }),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/providers/oauth/oauth-adapter-registry", () => ({ oauthAdapterRegistry: oauthAdapterMock }));
vi.mock("@/server/services/credential-vault", () => ({ credentialVault: credentialVaultMock }));
vi.mock("@/server/services/workspace-service", () => ({ workspaceService }));
vi.mock("@/server/services/brand-knowledge-service", () => ({ brandKnowledgeService }));
vi.mock("@/lib/tenancy/guards", () => ({ buildTenantContextForUser }));
vi.mock("@/server/services/provider-initial-sync-service", () => ({
  providerInitialSyncService: providerInitialSyncMock,
}));
vi.mock("@/server/services/connection-scope-resolver", () => ({
  connectionScopeResolver: {
    upsertScopeRecord: vi.fn(),
    computeMissingScopes: vi.fn().mockReturnValue([]),
    getScopeRecord: vi.fn(),
    resolveRequestedScopes: vi.fn().mockReturnValue(["analytics.read"]),
  },
}));
vi.mock("@/server/services/connection-lifecycle-service", () => ({
  connectionLifecycleService: { transition: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@/server/services/provider-audit-service", () => ({
  providerAuditService: { recordEvent: vi.fn() },
}));
vi.mock("@/server/services/audit-service", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

import { oauthCallbackService } from "@/server/services/oauth-callback-service";
import { providerAccountDiscoveryService } from "@/server/services/provider-account-discovery-service";
import { activationService } from "@/server/services/activation-service";

const orgId = "org-golden-a";
const brandId = "brand-golden-a";
const projectId = "project-golden-a";

function buildGa4Transaction(stateToken: string) {
  const { signed } = createSignedOAuthStatePayload({
    organisationId: orgId,
    providerKey: "google-analytics",
    connectionId: "conn-ga4",
    returnUrl: "/integrations",
    nonce: stateToken,
  });
  return {
    id: "txn-ga4",
    organisationId: orgId,
    providerKey: "google-analytics",
    connectionId: "conn-ga4",
    initiatedByUserId: "profile-golden",
    encryptedState: encryptOAuthPayload({
      stateToken,
      signedState: signed,
      organisationId: orgId,
      userId: "profile-golden",
      providerKey: "google-analytics",
      connectionId: "conn-ga4",
    }),
    stateDigest: buildStateDigest(stateToken),
    codeVerifierReference: null,
    requestedScopes: ["analytics.read"],
    returnPath: "/integrations",
    redirectUri: resolveOAuthCallbackUrl("google-analytics"),
    expiresAt: new Date(Date.now() + 10 * 60_000),
    consumedAt: null,
  };
}

function mockWorkspace() {
  workspaceService.getResolvedWorkspace.mockResolvedValue({
    organisations: [{ id: orgId, name: "Golden Org" }],
    projects: [{ id: projectId, name: "Main" }],
    brands: [{ id: brandId, name: "Golden Brand" }],
    preference: {
      currentOrganisationId: orgId,
      currentProjectId: projectId,
      currentBrandId: brandId,
      onboardingCompletedAt: new Date("2026-08-01T00:00:00.000Z"),
      onboardingStep: null,
    },
  });
}

function mockActivationBaseline() {
  prismaMock.onboardingProgress.findUnique.mockResolvedValue({ stepData: {} });
  prismaMock.invitation.findFirst.mockResolvedValue(null);
  buildTenantContextForUser.mockResolvedValue({ organisationRole: OrganisationRole.OWNER });
  brandKnowledgeService.getSnapshot.mockResolvedValue({
    brand: { name: "Golden Brand", description: "Growth platform" },
    profile: { targetAudience: "SMB", shortDescription: "Evidence-led marketing" },
    messaging: { coreMessage: "Grow with evidence", elevatorPitch: null },
    audiences: [{ name: "Founders", archivedAt: null }],
    offers: [{ name: "Platform", archivedAt: null }],
    voice: { preferredTone: "Professional" },
    personas: [],
    competitors: [],
    assets: [],
    references: [],
    complianceRules: [],
  } as never);
  prismaMock.contentItem.count.mockResolvedValue(0);
  prismaMock.contentProvenance.count.mockResolvedValue(0);
  prismaMock.contentVariant.count.mockResolvedValue(0);
  prismaMock.contentApproval.count.mockResolvedValue(0);
  prismaMock.publication.count.mockResolvedValue(0);
  prismaMock.auditLog.findFirst.mockResolvedValue(null);
  prismaMock.advertisingCampaignPlan.count.mockResolvedValue(0);
  prismaMock.socialExperiment.count.mockResolvedValue(0);
}

describe("Golden Journey A — New Customer → First Insight", () => {
  beforeEach(() => {
    resetJourneyMonitor();
    vi.clearAllMocks();
    resetEnvCacheForTests();
    process.env.ENCRYPTION_KEY = "a".repeat(32);
    process.env.OAUTH_STATE_SIGNING_KEY = "b".repeat(32);
    process.env.APP_URL = "https://app.example.com";
    process.env.GOOGLE_CLIENT_ID = "google-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret";
    process.env.ALLOW_OAUTH_MOCK = "true";
    vi.stubEnv("NODE_ENV", "test");
    mockWorkspace();
    mockActivationBaseline();

    oauthAdapterMock.exchangeAuthorizationCode.mockResolvedValue({
      accessToken: "ga4-access",
      refreshToken: "ga4-refresh",
      expiresAt: new Date(Date.now() + 3600_000),
      grantedScopes: ["analytics.read"],
    });
    oauthAdapterMock.validateConnection.mockResolvedValue({ healthy: true });
    oauthAdapterMock.discoverAccounts.mockResolvedValue([
      {
        externalAccountId: "properties/111",
        accountType: "analytics_property",
        displayName: "Marketing Site",
        metadata: {},
      },
      {
        externalAccountId: "properties/222",
        accountType: "analytics_property",
        displayName: "Blog Site",
        metadata: {},
      },
    ]);
    prismaMock.providerConnectionAccount.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.providerConnectionAccount.createMany.mockResolvedValue({ count: 2 });
    prismaMock.userProfile.findUnique.mockResolvedValue({ id: "profile-golden", authUserId: "auth-golden" });
    prismaMock.providerConnection.findFirst.mockResolvedValue({
      id: "conn-ga4",
      organisationId: orgId,
      providerKey: "google-analytics",
      status: "CONNECTED",
      metadata: {},
    });
    prismaMock.$transaction.mockImplementation(async (ops: unknown) => {
      if (typeof ops === "function") return ops(prismaMock);
      if (Array.isArray(ops)) {
        for (const op of ops) await op;
      }
    });
  });

  it("completes GA4 OAuth, explicit account selection, sync, and first insight", async () => {
    const stateToken = "state-ga4-golden";
    const transaction = buildGa4Transaction(stateToken);
    prismaMock.oAuthTransaction.findUnique.mockResolvedValue(transaction);

    const callback = await oauthCallbackService.handleCallback({
      providerKey: "google-analytics",
      code: "auth-code-ga4",
      state: stateToken,
      redirectUri: transaction.redirectUri,
    });
    expect(callback.connectionId).toBe("conn-ga4");

    oauthAdapterMock.discoverAccounts.mockResolvedValue([
      {
        externalAccountId: "properties/111",
        accountType: "analytics_property",
        displayName: "Marketing Site",
        metadata: {},
      },
      {
        externalAccountId: "properties/222",
        accountType: "analytics_property",
        displayName: "Blog Site",
        metadata: {},
      },
    ]);
    prismaMock.providerConnectionAccount.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.providerConnectionAccount.createMany.mockResolvedValue({ count: 2 });

    const discovery = await providerAccountDiscoveryService.discoverAndStoreAccounts({
      organisationId: orgId,
      connectionId: "conn-ga4",
      providerKey: "google-analytics",
      accessToken: "ga4-access",
    });
    expect(discovery.discovered).toBe(2);

    prismaMock.providerConnectionAccount.findMany.mockResolvedValue([
      {
        id: "acc-1",
        externalAccountId: "properties/111",
        accountType: "analytics_property",
        displayName: "Marketing Site",
        status: "DISCOVERED",
      },
      {
        id: "acc-2",
        externalAccountId: "properties/222",
        accountType: "analytics_property",
        displayName: "Blog Site",
        status: "DISCOVERED",
      },
    ]);

    await providerAccountDiscoveryService.selectAccounts({
      organisationId: orgId,
      connectionId: "conn-ga4",
      externalAccountIds: ["properties/111"],
      actorUserId: "profile-golden",
    });

    const sync = await providerInitialSyncMock.triggerAfterAccountSelection({
      connectionId: "conn-ga4",
      selectedAccountIds: ["properties/111"],
      organisationId: orgId,
      brandId,
      userId: "profile-golden",
    });
    expect(sync.queued).toBe(true);

    prismaMock.providerConnection.findMany.mockResolvedValue([
      { providerKey: "google-analytics", status: ProviderConnectionStatus.CONNECTED },
    ]);
    prismaMock.providerSyncRun.findMany.mockResolvedValue([]);
    prismaMock.providerSyncRun.findFirst.mockResolvedValue({ id: "sync-ga4-1" });
    prismaMock.marketingMetricObservation.count.mockResolvedValue(12);
    prismaMock.growthRecommendation.findFirst.mockResolvedValue({
      id: "rec-golden-1",
      status: GrowthRecommendationStatus.ACTIVE,
    });
    prismaMock.contentProvenance.count.mockResolvedValue(1);

    const activation = await activationService.getState("profile-golden");
    expect(
      activation.checklist.essential.find((i) => i.id === "first_provider_connected")?.status,
    ).toBe("complete");
    expect(
      activation.checklist.optional.find((i) => i.id === "first_analytics_observation")?.status,
    ).toBe("complete");
    expect(
      activation.checklist.essential.find((i) => i.id === "first_recommendation_generated")?.status,
    ).toBe("complete");
    expect(activation.isActivated).toBe(true);

    const metrics = finishJourneyMonitor();
    expect(metrics.unexpected5xx).toBe(0);
  });
});
