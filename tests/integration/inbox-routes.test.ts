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

import { GET as listConversations } from "@/app/api/brands/[brandId]/social/inbox/conversations/route";
import { POST as sendReply } from "@/app/api/brands/[brandId]/social/inbox/conversations/[conversationId]/reply/route";
import { POST as suggestReply } from "@/app/api/brands/[brandId]/social/inbox/conversations/[conversationId]/suggest/route";

const originalAllowTestAuth = process.env.ALLOW_TEST_AUTH;
const originalTestAuthUserId = process.env.TEST_AUTH_USER_ID;

function buildRequest(path: string, init: RequestInit = {}) {
  return new NextRequest(`https://app.test${path}`, init);
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
        `/api/brands/${inboxTestIds.brandId}/social/inbox/conversations?organisationId=${inboxTestIds.organisationId}`,
      ),
      brandParams,
    );

    expect(response.status).toBe(200);
    expect(queryService.listConversations).toHaveBeenCalled();
    expect((await response.json()).data.conversations).toEqual({ items: [], nextCursor: null });
  });

  it("rejects inbox read when organisation context is missing", async () => {
    const response = await listConversations(
      buildRequest(`/api/brands/${inboxTestIds.brandId}/social/inbox/conversations`),
      brandParams,
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("TENANT_CONTEXT_REQUIRED");
    expect(queryService.listConversations).not.toHaveBeenCalled();
  });

  it("rejects inbox read for viewers without socialInbox.read", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: inboxTestIds.userProfileId,
      organisationId: inboxTestIds.organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });

    const response = await listConversations(
      buildRequest(
        `/api/brands/${inboxTestIds.brandId}/social/inbox/conversations?organisationId=${inboxTestIds.organisationId}`,
      ),
      brandParams,
    );

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
    expect(queryService.listConversations).not.toHaveBeenCalled();
  });

  it("sends replies when the caller has inbox reply permission", async () => {
    const response = await sendReply(
      buildRequest(
        `/api/brands/${inboxTestIds.brandId}/social/inbox/conversations/${inboxTestIds.conversationId}/reply?organisationId=${inboxTestIds.organisationId}&socialAccountId=${inboxTestIds.socialAccountId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
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

    const response = await sendReply(
      buildRequest(
        `/api/brands/${inboxTestIds.brandId}/social/inbox/conversations/${inboxTestIds.conversationId}/reply?organisationId=${inboxTestIds.organisationId}&socialAccountId=${inboxTestIds.socialAccountId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
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
    const response = await suggestReply(
      buildRequest(
        `/api/brands/${inboxTestIds.brandId}/social/inbox/conversations/${inboxTestIds.conversationId}/suggest?organisationId=${inboxTestIds.organisationId}&socialAccountId=${inboxTestIds.socialAccountId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tone: "friendly" }),
        },
      ),
      conversationParams,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.suggestion).toMatchObject({
      draft: "Suggested reply",
      autoSent: false,
    });
    expect(suggestionService.suggestReply).toHaveBeenCalled();
    expect(replyService.sendReply).not.toHaveBeenCalled();
  });

  it("requires organisation context for AI suggestions", async () => {
    const response = await suggestReply(
      buildRequest(
        `/api/brands/${inboxTestIds.brandId}/social/inbox/conversations/${inboxTestIds.conversationId}/suggest?socialAccountId=${inboxTestIds.socialAccountId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      ),
      conversationParams,
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("TENANT_CONTEXT_REQUIRED");
    expect(suggestionService.suggestReply).not.toHaveBeenCalled();
  });
});
