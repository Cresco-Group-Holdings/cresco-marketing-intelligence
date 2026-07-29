import type { TenantContext } from "@/lib/tenancy/context";

export const inboxTestIds = {
  organisationId: "org-inbox-test",
  projectId: "project-inbox-test",
  brandId: "brand-inbox-test",
  userProfileId: "user-inbox-test",
  socialAccountId: "account-inbox-test",
  connectionId: "connection-inbox-test",
  conversationId: "conversation-inbox-test",
  draftId: "draft-inbox-test",
};

export const inboxTenantContext: TenantContext = {
  userId: "auth-user-inbox-test",
  userProfileId: inboxTestIds.userProfileId,
  organisationId: inboxTestIds.organisationId,
  organisationRole: "OWNER",
  projectId: inboxTestIds.projectId,
  brandId: inboxTestIds.brandId,
};

export const inboxAccountScope = {
  organisationId: inboxTestIds.organisationId,
  projectId: inboxTestIds.projectId,
  brandId: inboxTestIds.brandId,
  socialAccountId: inboxTestIds.socialAccountId,
  provider: "INSTAGRAM" as const,
};

export function createMockConversation(
  overrides: Partial<{
    id: string;
    socialAccountId: string;
    organisationId: string;
    brandId: string;
    projectId: string;
    provider: import("@prisma/client").SocialProvider;
    status: import("@prisma/client").SocialConversationStatus;
    conversationType: import("@prisma/client").SocialConversationType;
    capabilities: Array<{ capability: string }>;
    socialConnectionId: string;
    providerAccountId: string;
    relatedProviderPostId: string | null;
    providerConversationId: string;
  }> = {},
) {
  return {
    id: inboxTestIds.conversationId,
    organisationId: inboxTestIds.organisationId,
    projectId: inboxTestIds.projectId,
    brandId: inboxTestIds.brandId,
    socialAccountId: inboxTestIds.socialAccountId,
    provider: "INSTAGRAM" as const,
    status: "NEW" as const,
    conversationType: "COMMENT" as const,
    providerConversationId: "ig-conv-1",
    relatedProviderPostId: "ig-post-1",
    summary: "Test conversation",
    safetyFlags: [] as import("@prisma/client").SocialSafetyFlag[],
    requiresHumanReview: false,
    unreadCount: 1,
    socialAccount: {
      id: inboxTestIds.socialAccountId,
      providerAccountId: "ig-account-1",
      socialConnectionId: inboxTestIds.connectionId,
      capabilities: [{ capability: "MANAGE_COMMENTS" }, { capability: "READ_COMMENTS" }],
      socialConnection: { id: inboxTestIds.connectionId },
    },
    ...overrides,
  };
}
