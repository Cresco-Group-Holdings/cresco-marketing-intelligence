import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";
import { inboxTestIds } from "../helpers/inbox-mocks";

const queryService = vi.hoisted(() => ({
  listConversations: vi.fn(),
}));

const replyService = vi.hoisted(() => ({
  sendReply: vi.fn(),
}));

const suggestionService = vi.hoisted(() => ({
  suggestReply: vi.fn(),
}));

const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/social-inbox-query-service", () => ({
  socialInboxQueryService: queryService,
}));
vi.mock("@/server/services/social-inbox-reply-service", () => ({
  socialInboxReplyService: replyService,
}));
vi.mock("@/server/services/inbox-reply-suggestion-service", () => ({
  inboxReplySuggestionService: suggestionService,
}));
vi.mock("@/lib/tenancy/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenancy/guards")>();
  return {
    ...actual,
    buildTenantContext,
  };
});
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn().mockResolvedValue({
    authUserId: "test-auth-user",
    email: "test@example.com",
    userProfileId: inboxTestIds.userProfileId,
  }),
  extractProviderMetadata: vi.fn().mockReturnValue({}),
}));

import { GET as listConversations } from "@/app/api/brands/[brandId]/inbox/conversations/route";
import { POST as conversationActions } from "@/app/api/brands/[brandId]/inbox/conversations/[conversationId]/actions/route";

const originalAllowTestAuth = process.env.ALLOW_TEST_AUTH;
const originalTestAuthUserId = process.env.TEST_AUTH_USER_ID;

function buildRequest(
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1],
) {
  return new NextRequest(`https://app.test${path}`, init);
}

async function expectTenantRequired(call: () => Promise<Response>) {
  await expect(call()).rejects.toMatchObject({
    code: "TENANT_CONTEXT_REQUIRED",
  });
}

const brandParams = { params: Promise.resolve({ brandId: inboxTestIds.brandId }) };
const conversationParams = {
  params: Promise.resolve({
    brandId: inboxTestIds.brandId,
    conversationId: inboxTestIds.conversationId,
  }),
};

describe("inbox route authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOW_TEST_AUTH = "true";
    process.env.TEST_AUTH_USER_ID = "test-auth-user";

    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: inboxTestIds.userProfileId,
      organisationId: inboxTestIds.organisationId,
      organisationRole: OrganisationRole.OWNER,
    });

    queryService.listConversations.mockResolvedValue({ items: [], nextCursor: null });
    replyService.sendReply.mockResolvedValue({ id: "msg-1", body: "Thanks!" });
    suggestionService.suggestReply.mockResolvedValue({
      draft: "Suggested reply",
      aiRequestId: "ai-req-1",
      autoSent: false,
    });
  });

  afterEach(() => {
    if (originalAllowTestAuth === undefined) delete process.env.ALLOW_TEST_AUTH;
    else process.env.ALLOW_TEST_AUTH = originalAllowTestAuth;
    if (originalTestAuthUserId === undefined) delete process.env.TEST_AUTH_USER_ID;
    else process.env.TEST_AUTH_USER_ID = originalTestAuthUserId;
  });

  it("returns conversations when the caller has inbox read permission", async () => {
    const response = await listConversations(
      buildRequest(
        `/api/brands/${inboxTestIds.brandId}/inbox/conversations?organisationId=${inboxTestIds.organisationId}`,
      ),
      brandParams,
    );

    expect(response.status).toBe(200);
    expect(queryService.listConversations).toHaveBeenCalled();
    expect((await response.json()).data).toEqual({ items: [], nextCursor: null });
  });

  it("rejects inbox read when organisation context is missing", async () => {
    await expectTenantRequired(() =>
      listConversations(
        buildRequest(`/api/brands/${inboxTestIds.brandId}/inbox/conversations`),
        brandParams,
      ),
    );
    expect(queryService.listConversations).not.toHaveBeenCalled();
  });

  it("allows analysts to read the inbox", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: inboxTestIds.userProfileId,
      organisationId: inboxTestIds.organisationId,
      organisationRole: OrganisationRole.ANALYST,
    });

    const response = await listConversations(
      buildRequest(
        `/api/brands/${inboxTestIds.brandId}/inbox/conversations?organisationId=${inboxTestIds.organisationId}`,
      ),
      brandParams,
    );

    expect(response.status).toBe(200);
    expect(queryService.listConversations).toHaveBeenCalled();
  });

  it("sends replies when the caller has inbox reply permission", async () => {
    const response = await conversationActions(
      buildRequest(
        `/api/brands/${inboxTestIds.brandId}/inbox/conversations/${inboxTestIds.conversationId}/actions?action=reply&organisationId=${inboxTestIds.organisationId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            socialAccountId: inboxTestIds.socialAccountId,
            body: "Thanks for your message!",
            idempotencyKey: "reply-key-123456",
          }),
        },
      ),
      conversationParams,
    );

    expect(response.status).toBe(200);
    expect(replyService.sendReply).toHaveBeenCalledWith(
      inboxTestIds.brandId,
      inboxTestIds.organisationId,
      inboxTestIds.conversationId,
      expect.objectContaining({
        socialAccountId: inboxTestIds.socialAccountId,
        body: "Thanks for your message!",
      }),
      expect.objectContaining({ organisationId: inboxTestIds.organisationId }),
    );
  });

  it("rejects reply attempts from viewers without socialInbox.reply", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: inboxTestIds.userProfileId,
      organisationId: inboxTestIds.organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });

    const response = await conversationActions(
      buildRequest(
        `/api/brands/${inboxTestIds.brandId}/inbox/conversations/${inboxTestIds.conversationId}/actions?action=reply&organisationId=${inboxTestIds.organisationId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            socialAccountId: inboxTestIds.socialAccountId,
            body: "Thanks!",
            idempotencyKey: "reply-key-123456",
          }),
        },
      ),
      conversationParams,
    );

    expect(response.status).toBe(403);
    expect(replyService.sendReply).not.toHaveBeenCalled();
  });

  it("returns AI suggestions as drafts without sending to the provider", async () => {
    const response = await conversationActions(
      buildRequest(
        `/api/brands/${inboxTestIds.brandId}/inbox/conversations/${inboxTestIds.conversationId}/actions?action=suggest&organisationId=${inboxTestIds.organisationId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            socialAccountId: inboxTestIds.socialAccountId,
            tone: "friendly",
          }),
        },
      ),
      conversationParams,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({
      draft: "Suggested reply",
      autoSent: false,
    });
    expect(suggestionService.suggestReply).toHaveBeenCalled();
    expect(replyService.sendReply).not.toHaveBeenCalled();
  });

  it("requires organisation context for AI suggestions", async () => {
    await expectTenantRequired(() =>
      conversationActions(
        buildRequest(
          `/api/brands/${inboxTestIds.brandId}/inbox/conversations/${inboxTestIds.conversationId}/actions?action=suggest`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              socialAccountId: inboxTestIds.socialAccountId,
            }),
          },
        ),
        conversationParams,
      ),
    );
    expect(suggestionService.suggestReply).not.toHaveBeenCalled();
  });
});
