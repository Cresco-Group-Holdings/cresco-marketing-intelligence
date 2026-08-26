import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTenant,
  databaseSuiteEnabled,
  prisma,
  resetDatabase,
} from "./helpers/analytics-fixtures";
import { OrganisationRole } from "@prisma/client";

const suite = databaseSuiteEnabled ? describe : describe.skip;

suite("provider cross-tenant isolation", () => {
  let tenantA: Awaited<ReturnType<typeof createTenant>>;
  let tenantB: Awaited<ReturnType<typeof createTenant>>;
  let connectionAId: string;

  beforeEach(async () => {
    await resetDatabase();
    tenantA = await createTenant();
    tenantB = await createTenant();

    const connection = await prisma.providerConnection.create({
      data: {
        organisationId: tenantA.organisation.id,
        projectId: tenantA.project.id,
        brandId: tenantA.brand.id,
        providerKey: "linkedin",
        category: "SOCIAL",
        authType: "OAUTH2_AUTHORIZATION_CODE",
        status: "CONNECTED",
        displayName: "Tenant A LinkedIn",
      },
    });
    connectionAId = connection.id;

    await prisma.providerConnectionAccount.create({
      data: {
        organisationId: tenantA.organisation.id,
        connectionId: connectionAId,
        providerKey: "linkedin",
        externalAccountId: "org-tenant-a",
        accountType: "organization",
        displayName: "Tenant A Org",
        status: "SELECTED",
        selectedAt: new Date(),
      },
    });
  });

  afterEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function tenantContext(tenant: Awaited<ReturnType<typeof createTenant>>) {
    return {
      userId: tenant.user.id,
      userProfileId: tenant.user.id,
      organisationId: tenant.organisation.id,
      organisationRole: OrganisationRole.OWNER,
      projectId: tenant.project.id,
      brandId: tenant.brand.id,
    };
  }

  it("prevents tenant B from reading tenant A ProviderConnection", async () => {
    const { providerConnectionService } = await import("@/server/services/provider-connection-service");

    await expect(
      providerConnectionService.getConnection(tenantContext(tenantB), connectionAId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("prevents tenant B from disconnecting tenant A provider", async () => {
    const { integrationsConnectionService } = await import(
      "@/server/services/integrations-connection-service"
    );

    await expect(
      integrationsConnectionService.disconnect(tenantContext(tenantB), connectionAId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("prevents tenant B from listing tenant A discovered accounts", async () => {
    const { integrationsConnectionService } = await import(
      "@/server/services/integrations-connection-service"
    );

    await expect(
      integrationsConnectionService.listAccounts(tenantContext(tenantB), connectionAId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("prevents tenant B from selecting tenant A accounts", async () => {
    const { integrationsConnectionService } = await import(
      "@/server/services/integrations-connection-service"
    );

    await expect(
      integrationsConnectionService.selectAccounts(tenantContext(tenantB), connectionAId, [
        "org-tenant-a",
      ]),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("prevents tenant B from reconnecting tenant A provider", async () => {
    const { integrationsConnectionService } = await import(
      "@/server/services/integrations-connection-service"
    );

    await expect(
      integrationsConnectionService.reconnect(tenantContext(tenantB), connectionAId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
