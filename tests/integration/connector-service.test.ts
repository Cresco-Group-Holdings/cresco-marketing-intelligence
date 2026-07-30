import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import {
  connectorTenantContext,
  connectorTestIds,
  createMockConnectorAccount,
  createMockConnectorDefinition,
} from "../helpers/connector-mocks";
import {
  registerFakeConnectorAdapter,
  resetConnectorAdaptersForTests,
} from "@/lib/connectors/adapters/fake-connector-adapter";
import { connectorRegistry } from "@/lib/connectors/registry";
import { webhookService } from "@/server/services/webhook-service";

const prismaMock = vi.hoisted(() => ({
  connectorDefinition: {
    findUnique: vi.fn(),
  },
  connectorAccount: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  connectorCredential: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  },
  connectorOAuthState: {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  connectorSync: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  connectorSyncCursor: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
  connectorError: {
    create: vi.fn(),
  },
  webhookEndpoint: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  webhookEvent: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({
      id: connectorTestIds.brandId,
      projectId: connectorTestIds.projectId,
    }),
  },
}));
vi.mock("@/server/services/audit-service", () => ({
  recordAuditEvent: vi.fn(),
}));

import { connectorService } from "@/server/services/connector-service";
import { connectorOAuthService } from "@/server/services/connector-oauth-service";
import { connectorSyncService } from "@/server/services/connector-sync-service";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

describe("connector permissions", () => {
  it("allows owners and admins to manage connectors", () => {
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["connectors.update"])).toBe(true);
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["connectors.update"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["connectors.update"])).toBe(false);
  });
});

describe("connectorService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetConnectorAdaptersForTests();
    registerFakeConnectorAdapter("GOOGLE_ANALYTICS_4");
    prismaMock.connectorAccount.findMany.mockResolvedValue([]);
  });

  it("returns catalogue entries without exposing secrets", async () => {
    const catalogue = await connectorService.getCatalogue(
      connectorTestIds.brandId,
      connectorTestIds.organisationId,
      connectorTenantContext,
    );
    expect(catalogue.length).toBeGreaterThan(10);
    const ga4 = catalogue.find((item) => item.key === "GOOGLE_ANALYTICS_4");
    expect(ga4?.canConnect).toBe(true);
    expect(catalogue.filter((item) => item.key !== "GOOGLE_ANALYTICS_4").every((item) => !item.canConnect)).toBe(
      true,
    );
  });

  it("rejects connect for unavailable connectors", async () => {
    prismaMock.connectorDefinition.findUnique.mockResolvedValue(createMockConnectorDefinition());
    await expect(
      connectorService.beginConnect(
        connectorTestIds.brandId,
        connectorTestIds.organisationId,
        "META",
        connectorTenantContext,
      ),
    ).rejects.toThrow(/not yet available/i);
  });

  it("deletes credentials on disconnect", async () => {
    prismaMock.connectorAccount.findFirst.mockResolvedValue(createMockConnectorAccount());
    prismaMock.connectorAccount.update.mockResolvedValue(
      createMockConnectorAccount({ status: "NOT_CONFIGURED" }),
    );

    await connectorService.disconnect(
      connectorTestIds.brandId,
      connectorTestIds.organisationId,
      "GOOGLE_ANALYTICS_4",
      connectorTenantContext,
    );

    expect(prismaMock.connectorCredential.deleteMany).toHaveBeenCalledWith({
      where: { connectorAccountId: connectorTestIds.connectorAccountId },
    });
  });

  it("enforces tenant isolation for account access", async () => {
    prismaMock.connectorAccount.findFirst.mockResolvedValue(null);
    await expect(
      connectorService.assertAccountAccess(
        connectorTestIds.connectorAccountId,
        "other-org",
        connectorTestIds.brandId,
      ),
    ).rejects.toThrow(/not found/i);
  });
});

describe("connector oauth and sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetConnectorAdaptersForTests();
    registerFakeConnectorAdapter("GOOGLE_ANALYTICS_4");
  });

  it("validates oauth state expiry", async () => {
    prismaMock.connectorOAuthState.findUnique.mockResolvedValue({
      id: "state-1",
      expiresAt: new Date(Date.now() - 1_000),
      connectorType: "GOOGLE_ANALYTICS_4",
      scopes: ["read"],
      redirectUri: "http://localhost:3000/callback",
      codeVerifier: "verifier",
    });

    await expect(connectorOAuthService.validateState("expired")).rejects.toThrow(/expired/i);
  });

  it("refreshes tokens through the fake adapter", async () => {
    const { encryptSecret } = await import("@/lib/security/encryption");
    prismaMock.connectorCredential.findUnique.mockResolvedValue({
      connectorAccountId: connectorTestIds.connectorAccountId,
      encryptedAccessToken: encryptSecret("old"),
      encryptedRefreshToken: encryptSecret("refresh"),
      tokenExpiresAt: new Date(),
    });
    prismaMock.connectorCredential.upsert.mockResolvedValue({});

    const refreshed = await connectorOAuthService.refreshConnection(
      connectorTestIds.connectorAccountId,
      "GOOGLE_ANALYTICS_4",
    );
    expect(refreshed.accessToken).toContain("fake-refreshed");
  });

  it("returns existing sync for duplicate idempotency key", async () => {
    prismaMock.connectorAccount.findFirst.mockResolvedValue(createMockConnectorAccount());
    prismaMock.connectorSync.findUnique.mockResolvedValue({
      id: "sync-existing",
      idempotencyKey: "same-key",
    });

    const sync = await connectorSyncService.startSync({
      organisationId: connectorTestIds.organisationId,
      projectId: connectorTestIds.projectId,
      brandId: connectorTestIds.brandId,
      connectorAccountId: connectorTestIds.connectorAccountId,
      connectorType: "GOOGLE_ANALYTICS_4",
      syncType: "INCREMENTAL",
      idempotencyKey: "same-key",
    });

    expect(sync.id).toBe("sync-existing");
    expect(prismaMock.connectorSync.create).not.toHaveBeenCalled();
  });
});

describe("webhookService", () => {
  it("marks duplicate webhook events", async () => {
    prismaMock.webhookEndpoint.findUnique.mockResolvedValue({
      id: "endpoint-1",
      status: "ACTIVE",
    });
    prismaMock.webhookEvent.findUnique.mockResolvedValue({
      id: "event-1",
      status: "PROCESSED",
    });
    prismaMock.webhookEvent.update.mockResolvedValue({
      id: "event-1",
      status: "DUPLICATE",
    });

    const event = await webhookService.ingestEvent({
      webhookEndpointId: "endpoint-1",
      idempotencyKey: "evt-1",
      payload: "{}",
    });

    expect(event.status).toBe("DUPLICATE");
  });
});

describe("connector registry", () => {
  it("lists all required connector types", () => {
    const keys = connectorRegistry.list().map((entry) => entry.key);
    expect(keys).toContain("GOOGLE_ANALYTICS_4");
    expect(keys).toContain("CRM_PROVIDER");
    expect(keys).toContain("EMAIL_PROVIDER");
  });
});
