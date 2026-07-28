import { OrganisationRole } from "@prisma/client";

const ROLE_RANK: Record<OrganisationRole, number> = {
  VIEWER: 1,
  ANALYST: 2,
  MARKETER: 3,
  ADMIN: 4,
  OWNER: 5,
};

export function hasMinimumRole(
  actual: OrganisationRole,
  required: OrganisationRole,
): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export function canManageOrganisation(role: OrganisationRole): boolean {
  return hasMinimumRole(role, OrganisationRole.ADMIN);
}

export function canEditMarketingAssets(role: OrganisationRole): boolean {
  return hasMinimumRole(role, OrganisationRole.MARKETER);
}

export function canViewAnalytics(role: OrganisationRole): boolean {
  return hasMinimumRole(role, OrganisationRole.ANALYST);
}
