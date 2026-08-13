import type { CampaignMemberRole } from "@prisma/client";
import type { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const WRITE_MEMBER_ROLES: CampaignMemberRole[] = ["OWNER", "MANAGER", "CONTRIBUTOR"];
const MANAGE_MEMBER_ROLES: CampaignMemberRole[] = ["OWNER", "MANAGER"];

export function canReadCampaign(organisationRole: OrganisationRole): boolean {
  return hasPermission(organisationRole, PERMISSIONS["campaign.read"]);
}

export function canCreateCampaign(organisationRole: OrganisationRole): boolean {
  return hasPermission(organisationRole, PERMISSIONS["campaign.create"]);
}

export function canUpdateCampaign(
  organisationRole: OrganisationRole,
  memberRole?: CampaignMemberRole | null,
): boolean {
  if (!hasPermission(organisationRole, PERMISSIONS["campaign.update"])) return false;
  if (!memberRole) return true;
  return WRITE_MEMBER_ROLES.includes(memberRole);
}

export function canTransitionCampaign(
  organisationRole: OrganisationRole,
  memberRole?: CampaignMemberRole | null,
): boolean {
  if (!hasPermission(organisationRole, PERMISSIONS["campaign.transition"])) return false;
  if (!memberRole) return true;
  return MANAGE_MEMBER_ROLES.includes(memberRole);
}

export function canArchiveCampaign(
  organisationRole: OrganisationRole,
  memberRole?: CampaignMemberRole | null,
): boolean {
  if (!hasPermission(organisationRole, PERMISSIONS["campaign.archive"])) return false;
  if (!memberRole) return true;
  return MANAGE_MEMBER_ROLES.includes(memberRole);
}

export function canRestoreCampaign(
  organisationRole: OrganisationRole,
  memberRole?: CampaignMemberRole | null,
): boolean {
  if (!hasPermission(organisationRole, PERMISSIONS["campaign.restore"])) return false;
  if (!memberRole) return true;
  return MANAGE_MEMBER_ROLES.includes(memberRole);
}

export function canManageCampaignMembers(
  organisationRole: OrganisationRole,
  memberRole?: CampaignMemberRole | null,
): boolean {
  if (!hasPermission(organisationRole, PERMISSIONS["campaign.manage_members"])) return false;
  if (!memberRole) return true;
  return MANAGE_MEMBER_ROLES.includes(memberRole);
}

export function canManageCampaignKpis(
  organisationRole: OrganisationRole,
  memberRole?: CampaignMemberRole | null,
): boolean {
  if (!hasPermission(organisationRole, PERMISSIONS["campaign.manage_kpis"])) return false;
  if (!memberRole) return true;
  return WRITE_MEMBER_ROLES.includes(memberRole);
}

export function isCampaignMemberRole(role: string): role is CampaignMemberRole {
  return ["OWNER", "MANAGER", "CONTRIBUTOR", "VIEWER"].includes(role);
}
