import { prisma } from "@/lib/database/prisma";

/** Active workspace members who should receive operational notifications. */
export async function getOrganisationNotifierUserIds(organisationId: string): Promise<string[]> {
  const memberships = await prisma.organisationMembership.findMany({
    where: {
      organisationId,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN", "MARKETER"] },
    },
    select: { userId: true },
  });
  return [...new Set(memberships.map((membership) => membership.userId))];
}

/** Approvers who can action content in review. */
export async function getOrganisationApproverUserIds(organisationId: string): Promise<string[]> {
  const memberships = await prisma.organisationMembership.findMany({
    where: {
      organisationId,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN"] },
    },
    select: { userId: true },
  });
  return [...new Set(memberships.map((membership) => membership.userId))];
}
