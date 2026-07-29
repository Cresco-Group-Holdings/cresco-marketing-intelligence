import { OrganisationRole } from "@prisma/client";
import { AppError } from "@/lib/errors";

export const PERMISSIONS = {
  "organisation.read": "organisation.read",
  "organisation.update": "organisation.update",
  "organisation.archive": "organisation.archive",
  "members.read": "members.read",
  "members.invite": "members.invite",
  "members.updateRole": "members.updateRole",
  "members.remove": "members.remove",
  "projects.create": "projects.create",
  "projects.read": "projects.read",
  "projects.update": "projects.update",
  "projects.archive": "projects.archive",
  "brands.create": "brands.create",
  "brands.read": "brands.read",
  "brands.update": "brands.update",
  "brands.archive": "brands.archive",
  "brandProfile.read": "brandProfile.read",
  "brandProfile.update": "brandProfile.update",
  "brandKnowledge.read": "brandKnowledge.read",
  "brandKnowledge.update": "brandKnowledge.update",
  "marketingAssets.read": "marketingAssets.read",
  "marketingAssets.update": "marketingAssets.update",
  "visualStudio.read": "visualStudio.read",
  "visualStudio.write": "visualStudio.write",
  "ai.diagnostics": "ai.diagnostics",
  "ai.usage.read": "ai.usage.read",
  "analytics.read": "analytics.read",
  "analytics.sync": "analytics.sync",
  "growth.read": "growth.read",
  "growth.generate": "growth.generate",
  "experiments.read": "experiments.read",
  "experiments.write": "experiments.write",
  "connectors.read": "connectors.read",
  "connectors.update": "connectors.update",
  "socialConnections.read": "socialConnections.read",
  "socialConnections.create": "socialConnections.create",
  "socialConnections.reconnect": "socialConnections.reconnect",
  "socialConnections.disconnect": "socialConnections.disconnect",
  "socialAccounts.assign": "socialAccounts.assign",
  "content.read": "content.read",
  "content.create": "content.create",
  "content.edit": "content.edit",
  "content.generate": "content.generate",
  "content.ideas": "content.ideas",
  "content.submitForReview": "content.submitForReview",
  "content.requestChanges": "content.requestChanges",
  "content.approve": "content.approve",
  "content.schedule": "content.schedule",
  "content.publish": "content.publish",
  "content.archive": "content.archive",
  "leads.read": "leads.read",
  "leads.write": "leads.write",
  "leads.assign": "leads.assign",
  "leads.qualify": "leads.qualify",
  "leads.export": "leads.export",
  "leads.delete": "leads.delete",
  "auditLogs.read": "auditLogs.read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<OrganisationRole, Permission[]> = {
  OWNER: Object.values(PERMISSIONS),
  ADMIN: [
    PERMISSIONS["organisation.read"],
    PERMISSIONS["organisation.update"],
    PERMISSIONS["members.read"],
    PERMISSIONS["members.invite"],
    PERMISSIONS["members.updateRole"],
    PERMISSIONS["members.remove"],
    PERMISSIONS["projects.create"],
    PERMISSIONS["projects.read"],
    PERMISSIONS["projects.update"],
    PERMISSIONS["projects.archive"],
    PERMISSIONS["brands.create"],
    PERMISSIONS["brands.read"],
    PERMISSIONS["brands.update"],
    PERMISSIONS["brands.archive"],
    PERMISSIONS["brandProfile.read"],
    PERMISSIONS["brandProfile.update"],
    PERMISSIONS["brandKnowledge.read"],
    PERMISSIONS["brandKnowledge.update"],
    PERMISSIONS["marketingAssets.read"],
    PERMISSIONS["marketingAssets.update"],
    PERMISSIONS["visualStudio.read"],
    PERMISSIONS["visualStudio.write"],
    PERMISSIONS["ai.diagnostics"],
    PERMISSIONS["ai.usage.read"],
    PERMISSIONS["analytics.read"],
    PERMISSIONS["analytics.sync"],
    PERMISSIONS["growth.read"],
    PERMISSIONS["growth.generate"],
    PERMISSIONS["experiments.read"],
    PERMISSIONS["experiments.write"],
    PERMISSIONS["connectors.read"],
    PERMISSIONS["connectors.update"],
    PERMISSIONS["socialConnections.read"],
    PERMISSIONS["socialConnections.create"],
    PERMISSIONS["socialConnections.reconnect"],
    PERMISSIONS["socialConnections.disconnect"],
    PERMISSIONS["socialAccounts.assign"],
    PERMISSIONS["content.read"],
    PERMISSIONS["content.create"],
    PERMISSIONS["content.edit"],
    PERMISSIONS["content.generate"],
    PERMISSIONS["content.ideas"],
    PERMISSIONS["content.submitForReview"],
    PERMISSIONS["content.requestChanges"],
    PERMISSIONS["content.approve"],
    PERMISSIONS["content.schedule"],
    PERMISSIONS["content.publish"],
    PERMISSIONS["content.archive"],
    PERMISSIONS["leads.read"],
    PERMISSIONS["leads.write"],
    PERMISSIONS["leads.assign"],
    PERMISSIONS["leads.qualify"],
    PERMISSIONS["leads.export"],
    PERMISSIONS["leads.delete"],
    PERMISSIONS["auditLogs.read"],
  ],
  MARKETER: [
    PERMISSIONS["organisation.read"],
    PERMISSIONS["members.read"],
    PERMISSIONS["projects.create"],
    PERMISSIONS["projects.read"],
    PERMISSIONS["projects.update"],
    PERMISSIONS["brands.create"],
    PERMISSIONS["brands.read"],
    PERMISSIONS["brands.update"],
    PERMISSIONS["brandProfile.read"],
    PERMISSIONS["brandProfile.update"],
    PERMISSIONS["brandKnowledge.read"],
    PERMISSIONS["brandKnowledge.update"],
    PERMISSIONS["marketingAssets.read"],
    PERMISSIONS["marketingAssets.update"],
    PERMISSIONS["analytics.read"],
    PERMISSIONS["growth.read"],
    PERMISSIONS["growth.generate"],
    PERMISSIONS["experiments.read"],
    PERMISSIONS["experiments.write"],
    PERMISSIONS["visualStudio.read"],
    PERMISSIONS["visualStudio.write"],
    PERMISSIONS["connectors.read"],
    PERMISSIONS["connectors.update"],
    PERMISSIONS["socialConnections.read"],
    PERMISSIONS["socialConnections.create"],
    PERMISSIONS["socialConnections.reconnect"],
    PERMISSIONS["socialConnections.disconnect"],
    PERMISSIONS["socialAccounts.assign"],
    PERMISSIONS["content.read"],
    PERMISSIONS["content.create"],
    PERMISSIONS["content.edit"],
    PERMISSIONS["content.generate"],
    PERMISSIONS["content.ideas"],
    PERMISSIONS["content.submitForReview"],
    PERMISSIONS["content.archive"],
    PERMISSIONS["leads.read"],
    PERMISSIONS["leads.write"],
    PERMISSIONS["leads.assign"],
    PERMISSIONS["leads.qualify"],
    PERMISSIONS["leads.export"],
  ],
  ANALYST: [
    PERMISSIONS["organisation.read"],
    PERMISSIONS["members.read"],
    PERMISSIONS["projects.read"],
    PERMISSIONS["brands.read"],
    PERMISSIONS["brandProfile.read"],
    PERMISSIONS["brandKnowledge.read"],
    PERMISSIONS["marketingAssets.read"],
    PERMISSIONS["visualStudio.read"],
    PERMISSIONS["ai.usage.read"],
    PERMISSIONS["analytics.read"],
    PERMISSIONS["growth.read"],
    PERMISSIONS["experiments.read"],
    PERMISSIONS["connectors.read"],
    PERMISSIONS["socialConnections.read"],
    PERMISSIONS["content.read"],
    PERMISSIONS["leads.read"],
    PERMISSIONS["leads.export"],
    PERMISSIONS["auditLogs.read"],
  ],
  VIEWER: [
    PERMISSIONS["organisation.read"],
    PERMISSIONS["members.read"],
    PERMISSIONS["projects.read"],
    PERMISSIONS["brands.read"],
    PERMISSIONS["brandProfile.read"],
    PERMISSIONS["brandKnowledge.read"],
    PERMISSIONS["marketingAssets.read"],
    PERMISSIONS["visualStudio.read"],
    PERMISSIONS["connectors.read"],
    PERMISSIONS["socialConnections.read"],
    PERMISSIONS["content.read"],
    PERMISSIONS["leads.read"],
    PERMISSIONS["experiments.read"],
  ],
};

export function hasPermission(role: OrganisationRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function requirePermission(role: OrganisationRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new AppError("FORBIDDEN", `Missing permission: ${permission}`);
  }
}

export function canManageMember(
  actorRole: OrganisationRole,
  targetRole: OrganisationRole,
): boolean {
  if (!hasPermission(actorRole, PERMISSIONS["members.updateRole"])) {
    return false;
  }

  if (targetRole === OrganisationRole.OWNER && actorRole !== OrganisationRole.OWNER) {
    return false;
  }

  return true;
}

export function canChangeRole(
  actorRole: OrganisationRole,
  fromRole: OrganisationRole,
  toRole: OrganisationRole,
): boolean {
  if (!canManageMember(actorRole, fromRole)) {
    return false;
  }

  if (toRole === OrganisationRole.OWNER && actorRole !== OrganisationRole.OWNER) {
    return false;
  }

  if (fromRole === OrganisationRole.OWNER && actorRole !== OrganisationRole.OWNER) {
    return false;
  }

  return true;
}

export function getRolePermissions(role: OrganisationRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}
