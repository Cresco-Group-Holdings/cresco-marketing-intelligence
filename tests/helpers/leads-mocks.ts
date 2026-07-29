import type { TenantContext } from "@/lib/tenancy/context";

export const leadsTestIds = {
  organisationId: "org-leads-test",
  projectId: "project-leads-test",
  brandId: "brand-leads-test",
  userProfileId: "user-leads-test",
  leadId: "lead-test-1",
  socialAccountId: "account-leads-test",
};

export const leadsTenantContext: TenantContext = {
  userId: "auth-user-leads-test",
  userProfileId: leadsTestIds.userProfileId,
  organisationId: leadsTestIds.organisationId,
  organisationRole: "OWNER",
  projectId: leadsTestIds.projectId,
  brandId: leadsTestIds.brandId,
};
