import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  providerConnectionAccount: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const oauthAdapterMock = vi.hoisted(() => ({
  discoverAccounts: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/providers/oauth/oauth-adapter-registry", () => ({
  oauthAdapterRegistry: oauthAdapterMock,
}));

import { providerAccountDiscoveryService } from "@/server/services/provider-account-discovery-service";

describe("Meta account discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.providerConnectionAccount.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.providerConnectionAccount.createMany.mockResolvedValue({ count: 2 });
  });

  it("stores Facebook Pages and Instagram Business accounts with readable names", async () => {
    oauthAdapterMock.discoverAccounts.mockResolvedValue([
      {
        externalAccountId: "page-123",
        accountType: "facebook_page",
        displayName: "Acme Facebook Page",
        metadata: { provider: "facebook" },
      },
      {
        externalAccountId: "ig-456",
        accountType: "instagram_business",
        displayName: "Acme Instagram",
        metadata: { provider: "instagram", linkedPageId: "page-123" },
      },
    ]);

    const result = await providerAccountDiscoveryService.discoverAndStoreAccounts({
      organisationId: "org-1",
      connectionId: "conn-meta",
      providerKey: "meta",
      accessToken: "meta-token",
    });

    expect(result.discovered).toBe(2);
    expect(prismaMock.providerConnectionAccount.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            displayName: "Acme Facebook Page",
            accountType: "facebook_page",
          }),
          expect.objectContaining({
            displayName: "Acme Instagram",
            accountType: "instagram_business",
          }),
        ]),
      }),
    );
  });

  it("persists only explicitly selected external account ids", async () => {
    prismaMock.providerConnectionAccount.findMany.mockResolvedValue([
      {
        id: "acc-page",
        externalAccountId: "page-123",
        accountType: "facebook_page",
        displayName: "Acme Facebook Page",
        status: "DISCOVERED",
      },
      {
        id: "acc-ig",
        externalAccountId: "ig-456",
        accountType: "instagram_business",
        displayName: "Acme Instagram",
        status: "DISCOVERED",
      },
    ]);
    prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) await op;
    });
    prismaMock.providerConnectionAccount.update.mockResolvedValue({});

    const selected = await providerAccountDiscoveryService.selectAccounts({
      organisationId: "org-1",
      connectionId: "conn-meta",
      externalAccountIds: ["ig-456"],
      actorUserId: "profile-1",
    });

    expect(prismaMock.providerConnectionAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "acc-ig" },
        data: expect.objectContaining({ status: "SELECTED" }),
      }),
    );
    expect(selected).toBeDefined();
  });
});
