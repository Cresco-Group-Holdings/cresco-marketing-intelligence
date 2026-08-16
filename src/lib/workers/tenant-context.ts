import type { OrganisationRole } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import type { TenantContext } from "@/lib/tenancy/context";

export async function buildWorkerTenantContext(
  organisationId: string,
  actorUserId?: string | null,
): Promise<TenantContext> {
  if (actorUserId) {
    return {
      userId: actorUserId,
      userProfileId: actorUserId,
      organisationId,
      organisationRole: "ADMIN" as OrganisationRole,
    };
  }

  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { createdByUserId: true },
  });

  const userProfileId = organisation?.createdByUserId ?? organisationId;
  return {
    userId: userProfileId,
    userProfileId,
    organisationId,
    organisationRole: "ADMIN" as OrganisationRole,
  };
}
