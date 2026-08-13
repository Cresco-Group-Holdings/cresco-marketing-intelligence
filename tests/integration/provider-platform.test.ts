import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPlatformAdapterCacheForTests } from "@/lib/providers/platform-registry";
import { resetMockAdvertisingAdapterState } from "@/server/providers/mock-advertising/mock-advertising-adapter";

const prismaMock = {
  providerConnection: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  providerSyncRun: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  providerSyncRecord: {
    create: vi.fn(),
  },
  providerAccount: {
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/database/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/server/services/provider-credential-service", () => ({
  providerCredentialService: {
    getCredentialPlaintext: vi.fn().mockResolvedValue("valid-token"),
    storeCredential: vi.fn(),
  },
}));

vi.mock("@/server/services/provider-audit-service", () => ({
  providerAuditService: { recordEvent: vi.fn() },
}));

vi.mock("@/server/services/provider-health-service", () => ({
  providerHealthService: { upsertHealth: vi.fn() },
}));

describe("provider gateway integration", () => {
  const tenantContext = {
    userId: "user-1",
    userProfileId: "profile-1",
    organisationId: "org-1",
    organisationRole: "ADMIN" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetPlatformAdapterCacheForTests();
    resetMockAdvertisingAdapterState();
  });

  it("executes mock adapter operations for a tenant connection", async () => {
    const { providerGateway } = await import("@/server/services/provider-gateway-service");

    prismaMock.providerConnection.findFirst.mockResolvedValue({
      id: "conn-1",
      organisationId: "org-1",
      providerKey: "mock-advertising",
      providerVersion: "1.0-test",
      status: "CONNECTED",
      configuration: {},
      revokedAt: null,
    });
    prismaMock.providerConnection.update.mockResolvedValue({});

    const result = await providerGateway.execute(
      {
        organisationId: "org-1",
        connectionId: "conn-1",
        capability: "AD_CAMPAIGNS_READ",
        operation: "listCampaigns",
        input: { pageSize: 2 },
      },
      tenantContext,
    );

    expect(result.success).toBe(true);
    const data = result.data as { campaigns: Array<{ externalId: string }> };
    expect(data.campaigns).toHaveLength(2);
    expect(prismaMock.providerConnection.update).toHaveBeenCalled();
  });

  it("rejects cross-tenant connection access", async () => {
    const { providerGateway } = await import("@/server/services/provider-gateway-service");

    prismaMock.providerConnection.findFirst.mockResolvedValue(null);

    await expect(
      providerGateway.execute(
        {
          organisationId: "org-other",
          connectionId: "conn-1",
          capability: "AD_CAMPAIGNS_READ",
          operation: "listCampaigns",
          input: {},
        },
        { ...tenantContext, organisationId: "org-other" },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_CONNECTION_NOT_FOUND" });
  });

  it("rejects revoked connections", async () => {
    const { providerGateway } = await import("@/server/services/provider-gateway-service");

    prismaMock.providerConnection.findFirst.mockResolvedValue({
      id: "conn-1",
      organisationId: "org-1",
      providerKey: "mock-advertising",
      providerVersion: "1.0-test",
      status: "CONNECTED",
      configuration: {},
      revokedAt: new Date(),
    });

    await expect(
      providerGateway.execute(
        {
          organisationId: "org-1",
          connectionId: "conn-1",
          capability: "AD_CAMPAIGNS_READ",
          operation: "listCampaigns",
          input: {},
        },
        tenantContext,
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AUTH_FAILED" });
  });

  it("prevents duplicate running sync jobs", async () => {
    const { providerSyncEngineService } = await import(
      "@/server/services/provider-sync-engine-service"
    );

    prismaMock.providerConnection.findFirst.mockResolvedValue({
      id: "conn-1",
      organisationId: "org-1",
      providerKey: "mock-advertising",
      providerVersion: "1.0-test",
      status: "CONNECTED",
    });
    prismaMock.providerSyncRun.findFirst
      .mockResolvedValueOnce({ id: "running-1", status: "RUNNING" })
      .mockResolvedValueOnce(null);

    await expect(
      providerSyncEngineService.startSync(
        "conn-1",
        "org-1",
        { capability: "AD_CAMPAIGNS_READ", resourceType: "campaigns" },
        tenantContext,
      ),
    ).rejects.toMatchObject({ code: "SYNC_ALREADY_RUNNING" });
  });

  it("does not include credential payloads in gateway results", async () => {
    const { providerGateway } = await import("@/server/services/provider-gateway-service");

    prismaMock.providerConnection.findFirst.mockResolvedValue({
      id: "conn-1",
      organisationId: "org-1",
      providerKey: "mock-advertising",
      providerVersion: "1.0-test",
      status: "CONNECTED",
      configuration: {},
      revokedAt: null,
    });
    prismaMock.providerConnection.update.mockResolvedValue({});

    const result = await providerGateway.execute(
      {
        organisationId: "org-1",
        connectionId: "conn-1",
        capability: "AD_ACCOUNTS_READ",
        operation: "listAccounts",
        input: {},
      },
      tenantContext,
    );

    expect(JSON.stringify(result)).not.toMatch(/valid-token/);
    expect(JSON.stringify(result)).not.toMatch(/apiKey/);
  });
});
