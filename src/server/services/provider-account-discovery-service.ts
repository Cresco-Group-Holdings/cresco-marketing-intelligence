import { prisma } from "@/lib/database/prisma";
import type { Prisma } from "@prisma/client";
import { oauthAdapterRegistry } from "@/server/providers/oauth/oauth-adapter-registry";

export const providerAccountDiscoveryService = {
  async discoverAndStoreAccounts(input: {
    organisationId: string;
    connectionId: string;
    providerKey: string;
    accessToken: string;
  }) {
    const accounts = await oauthAdapterRegistry.discoverAccounts({
      providerKey: input.providerKey,
      accessToken: input.accessToken,
    });

    await prisma.providerConnectionAccount.deleteMany({
      where: {
        connectionId: input.connectionId,
        organisationId: input.organisationId,
        status: "DISCOVERED",
      },
    });

    if (accounts.length === 0) {
      return { discovered: 0 };
    }

    await prisma.providerConnectionAccount.createMany({
      data: accounts.map((account) => ({
        organisationId: input.organisationId,
        connectionId: input.connectionId,
        providerKey: input.providerKey,
        externalAccountId: account.externalAccountId,
        accountType: account.accountType,
        displayName: account.displayName,
        metadata: (account.metadata ?? {}) as Prisma.InputJsonValue,
        status: "DISCOVERED" as const,
      })),
      skipDuplicates: true,
    });

    return { discovered: accounts.length };
  },

  async listAccounts(organisationId: string, connectionId: string) {
    return prisma.providerConnectionAccount.findMany({
      where: { organisationId, connectionId },
      orderBy: [{ status: "asc" }, { displayName: "asc" }],
    });
  },

  async selectAccounts(input: {
    organisationId: string;
    connectionId: string;
    externalAccountIds: string[];
    actorUserId: string;
  }) {
    const accounts = await prisma.providerConnectionAccount.findMany({
      where: {
        organisationId: input.organisationId,
        connectionId: input.connectionId,
      },
    });

    const selectedSet = new Set(input.externalAccountIds);

    await prisma.$transaction(
      accounts.map((account) =>
        prisma.providerConnectionAccount.update({
          where: { id: account.id },
          data: {
            status: selectedSet.has(account.externalAccountId) ? "SELECTED" : "DISABLED",
            selectedAt: selectedSet.has(account.externalAccountId) ? new Date() : null,
          },
        }),
      ),
    );

    return this.listAccounts(input.organisationId, input.connectionId);
  },
};
