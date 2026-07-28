import { OrganisationRole } from "@prisma/client";
import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContext = {
  userId: string;
  userProfileId: string;
  organisationId: string;
  organisationRole: OrganisationRole;
  projectId?: string;
  brandId?: string;
};

const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function runWithTenantContext<T>(context: TenantContext, callback: () => T): T {
  return tenantStorage.run(context, callback);
}

export function getCurrentOrganisationContext(): TenantContext | null {
  return tenantStorage.getStore() ?? null;
}

export function requireCurrentOrganisationContext(): TenantContext {
  const context = getCurrentOrganisationContext();
  if (!context) {
    throw new Error("Tenant context is required but was not established.");
  }

  return context;
}

export function assertOrganisationScope(
  recordOrganisationId: string,
  context: TenantContext = requireCurrentOrganisationContext(),
): void {
  if (recordOrganisationId !== context.organisationId) {
    throw new Error("Cross-organisation access is not permitted.");
  }
}

export function assertProjectScope(
  recordProjectId: string,
  context: TenantContext = requireCurrentOrganisationContext(),
): void {
  if (!context.projectId) {
    throw new Error("Project context is required for this operation.");
  }

  if (recordProjectId !== context.projectId) {
    throw new Error("Cross-project access is not permitted.");
  }
}
