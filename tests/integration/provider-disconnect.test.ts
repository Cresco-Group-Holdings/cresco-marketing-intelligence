import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  providerConnection: { findFirst: vi.fn(), update: vi.fn() },
}));

const credentialVaultMock = vi.hoisted(() => ({
  readForExecution: vi.fn(),
  revokeAll: vi.fn(),
}));

const oauthAdapterMock = vi.hoisted(() => ({
  revokeToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/credential-vault", () => ({ credentialVault: credentialVaultMock }));
vi.mock("@/server/providers/oauth/oauth-adapter-registry", () => ({
  oauthAdapterRegistry: oauthAdapterMock,
}));
vi.mock("@/server/services/connection-lifecycle-service", () => ({
  connectionLifecycleService: { transition: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@/server/services/provider-audit-service", () => ({
  providerAuditService: { recordEvent: vi.fn().mockResolvedValue(undefined) },
}));

import { integrationsConnectionService } from "@/server/services/integrations-connection-service";

const tenant = {
  userId: "profile-1",
  userProfileId: "profile-1",
  organisationId: "org-a",
  organisationRole: OrganisationRole.OWNER,
};

describe("provider disconnect journey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.providerConnection.findFirst.mockResolvedValue({
      id: "conn-1",
      organisationId: "org-a",
      providerKey: "linkedin",
      status: "CONNECTED",
    });
    credentialVaultMock.readForExecution.mockResolvedValue("access-token");
    credentialVaultMock.revokeAll.mockResolvedValue(undefined);
    prismaMock.providerConnection.update.mockResolvedValue({});
  });

  it("revokes local credentials and attempts remote token revocation", async () => {
    const result = await integrationsConnectionService.disconnect(tenant, "conn-1");

    expect(result.disconnected).toBe(true);
    expect(oauthAdapterMock.revokeToken).toHaveBeenCalledWith({
      providerKey: "linkedin",
      accessToken: "access-token",
    });
    expect(credentialVaultMock.revokeAll).toHaveBeenCalled();
  });
});
