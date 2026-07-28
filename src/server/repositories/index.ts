import { prisma } from "@/lib/database/prisma";
import { assertOrganisationScope } from "@/lib/tenancy/context";
import type { TenantContext } from "@/lib/tenancy/context";

export const organisationRepository = {
  async findByIdForMember(organisationId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);

    return prisma.organisation.findFirst({
      where: {
        id: organisationId,
        archivedAt: null,
      },
    });
  },

  async listForUser(userProfileId: string) {
    return prisma.organisation.findMany({
      where: {
        archivedAt: null,
        memberships: {
          some: {
            userProfileId,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  },
};

export const projectRepository = {
  async listByOrganisation(organisationId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);

    return prisma.project.findMany({
      where: {
        organisationId,
        archivedAt: null,
      },
      orderBy: { name: "asc" },
    });
  },
};

export const brandRepository = {
  async listByProject(projectId: string, context: TenantContext) {
    if (!context.projectId || context.projectId !== projectId) {
      throw new Error("Project context is required and must match the requested project.");
    }

    return prisma.brand.findMany({
      where: {
        organisationId: context.organisationId,
        projectId,
        archivedAt: null,
      },
      orderBy: { name: "asc" },
    });
  },
};
