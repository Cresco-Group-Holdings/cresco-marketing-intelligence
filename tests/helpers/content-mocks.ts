import type { TenantContext } from "@/lib/tenancy/context";

export const contentTestIds = {
  organisationId: "org-content-test",
  projectId: "project-content-test",
  brandId: "brand-content-test",
  userProfileId: "user-content-test",
  contentId: "content-test-1",
};

export const contentTenantContext: TenantContext = {
  userId: "auth-user-content-test",
  userProfileId: contentTestIds.userProfileId,
  organisationId: contentTestIds.organisationId,
  organisationRole: "OWNER",
  projectId: contentTestIds.projectId,
  brandId: contentTestIds.brandId,
};

export function createMockContentItem(
  overrides: Partial<{
    id: string;
    title: string;
    status: import("@prisma/client").ContentStatus;
    contentType: import("@prisma/client").ContentType;
    primaryMessage: string | null;
    destinationUrl: string | null;
    createdByUserId: string;
    ownerUserId: string;
    variants: unknown[];
    assets: unknown[];
    provenance: unknown;
    comments: unknown[];
    complianceChecks: unknown[];
    approvals: unknown[];
  }> = {},
) {
  return {
    id: contentTestIds.contentId,
    organisationId: contentTestIds.organisationId,
    projectId: contentTestIds.projectId,
    brandId: contentTestIds.brandId,
    title: "Cresco Grants — Find UK funding opportunities",
    objectiveId: null,
    campaignName: "Grants launch",
    contentPillar: "Funding",
    contentType: "TEXT_POST" as const,
    primaryMessage: "Find UK funding opportunities",
    targetAudienceId: null,
    primaryCTA: "Learn more",
    destinationUrl: "https://example.com/grants",
    status: "DRAFT" as const,
    priority: "NORMAL" as const,
    ownerUserId: contentTestIds.userProfileId,
    createdByUserId: contentTestIds.userProfileId,
    approvedByUserId: null,
    approvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    variants: [],
    assets: [],
    provenance: null,
    comments: [],
    complianceChecks: [],
    approvals: [],
    ...overrides,
  };
}
