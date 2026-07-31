import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import {
  createMockConversation,
  inboxTenantContext,
  inboxTestIds,
} from "../helpers/inbox-mocks";

const prismaMock = vi.hoisted(() => ({
  socialConversation: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  socialMessage: {
    create: vi.fn(),
  },
  socialComment: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  socialInboxReplyDraft: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  socialInboxStatusHistory: {
    create: vi.fn(),
  },
  organisationMembership: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const adapterMock = vi.hoisted(() => ({
  sendReply: vi.fn(),
  hideComment: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({
      id: inboxTestIds.brandId,
      projectId: inboxTestIds.projectId,
    }),
  },
}));
vi.mock("@/server/services/social-credential-service", () => ({
  socialCredentialService: {
    readTokens: vi.fn().mockResolvedValue({ accessToken: "token-123", refreshToken: null }),
  },
}));
vi.mock("@/lib/inbox/adapters", () => ({
  getSocialInboxAdapter: vi.fn(() => adapterMock),
}));

import {
  assertConversationAccount,
  socialInboxReplyService,
} from "@/server/services/social-inbox-reply-service";

describe("inbox reply permissions", () => {
  it("allows roles with socialInbox.reply to send replies", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["socialInbox.reply"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["socialInbox.reply"])).toBe(false);
  });
});

describe("assertConversationAccount", () => {
  it("blocks replies when the social account does not match the conversation", () => {
    expect(() =>
      assertConversationAccount(
        { socialAccountId: inboxTestIds.socialAccountId },
        "other-account-id",
      ),
    ).toThrow(AppError);
    expect(() =>
      assertConversationAccount(
        { socialAccountId: inboxTestIds.socialAccountId },
        "other-account-id",
      ),
    ).toThrow(/does not match this conversation/);
  });
});

describe("socialInboxReplyService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapterMock.sendReply.mockResolvedValue({ providerMessageId: "provider-msg-1" });
    prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    });
  });

  it("rejects send when MANAGE_COMMENTS capability is missing", async () => {
    prismaMock.socialConversation.findFirst.mockResolvedValue(
      createMockConversation({
        socialAccount: {
          id: inboxTestIds.socialAccountId,
          providerAccountId: "ig-account-1",
          socialConnectionId: inboxTestIds.connectionId,
          capabilities: [{ capability: "READ_COMMENTS" }],
          socialConnection: { id: inboxTestIds.connectionId },
        },
      }),
    );

    await expect(
      socialInboxReplyService.sendReply(
        inboxTestIds.brandId,
        inboxTestIds.organisationId,
        inboxTestIds.conversationId,
        { socialAccountId: inboxTestIds.socialAccountId, body: "Thanks!" },
        inboxTenantContext,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(adapterMock.sendReply).not.toHaveBeenCalled();
  });

  it("rejects send when the selected account does not match the conversation", async () => {
    prismaMock.socialConversation.findFirst.mockResolvedValue(createMockConversation());

    await expect(
      socialInboxReplyService.sendReply(
        inboxTestIds.brandId,
        inboxTestIds.organisationId,
        inboxTestIds.conversationId,
        { socialAccountId: "wrong-account-id", body: "Thanks!" },
        inboxTenantContext,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creates a new draft when none exists", async () => {
    prismaMock.socialConversation.findFirst.mockResolvedValue(createMockConversation());
    prismaMock.socialInboxReplyDraft.findFirst.mockResolvedValue(null);
    prismaMock.socialInboxReplyDraft.create.mockResolvedValue({
      id: inboxTestIds.draftId,
      body: "Draft reply",
      status: "DRAFT",
    });

    const draft = await socialInboxReplyService.saveDraft(
      inboxTestIds.brandId,
      inboxTestIds.organisationId,
      inboxTestIds.conversationId,
      { socialAccountId: inboxTestIds.socialAccountId, body: "Draft reply" },
      inboxTenantContext,
    );

    expect(draft.body).toBe("Draft reply");
    expect(prismaMock.socialInboxReplyDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: inboxTestIds.conversationId,
          authorUserId: inboxTestIds.userProfileId,
          status: "DRAFT",
        }),
      }),
    );
  });

  it("updates an existing draft for the same author", async () => {
    prismaMock.socialConversation.findFirst.mockResolvedValue(createMockConversation());
    prismaMock.socialInboxReplyDraft.findFirst.mockResolvedValue({
      id: inboxTestIds.draftId,
      status: "DRAFT",
    });
    prismaMock.socialInboxReplyDraft.update.mockResolvedValue({
      id: inboxTestIds.draftId,
      body: "Updated draft",
      status: "DRAFT",
    });

    const draft = await socialInboxReplyService.saveDraft(
      inboxTestIds.brandId,
      inboxTestIds.organisationId,
      inboxTestIds.conversationId,
      { socialAccountId: inboxTestIds.socialAccountId, body: "Updated draft", aiGenerated: true },
      inboxTenantContext,
    );

    expect(draft.body).toBe("Updated draft");
    expect(prismaMock.socialInboxReplyDraft.update).toHaveBeenCalled();
    expect(prismaMock.socialInboxReplyDraft.create).not.toHaveBeenCalled();
  });

  it("records status transitions with history", async () => {
    prismaMock.socialConversation.findFirst.mockResolvedValue(
      createMockConversation({ status: "OPEN" }),
    );
    prismaMock.socialConversation.update.mockResolvedValue({
      id: inboxTestIds.conversationId,
      status: "RESOLVED",
    });
    prismaMock.socialInboxStatusHistory.create.mockResolvedValue({ id: "history-1" });

    const updated = await socialInboxReplyService.updateStatus(
      inboxTestIds.brandId,
      inboxTestIds.organisationId,
      inboxTestIds.conversationId,
      { socialAccountId: inboxTestIds.socialAccountId, status: "RESOLVED", reason: "Handled" },
      inboxTenantContext,
    );

    expect(updated.status).toBe("RESOLVED");
    expect(prismaMock.socialInboxStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: "OPEN",
          toStatus: "RESOLVED",
          changedByUserId: inboxTestIds.userProfileId,
          reason: "Handled",
        }),
      }),
    );
  });

  it("does not implement duplicate-send feedback (N/A for inbox replies)", async () => {
    prismaMock.socialConversation.findFirst.mockResolvedValue(createMockConversation());
    prismaMock.socialMessage.create.mockResolvedValue({ id: "msg-1" });
    prismaMock.socialConversation.update.mockResolvedValue({});

    await socialInboxReplyService.sendReply(
      inboxTestIds.brandId,
      inboxTestIds.organisationId,
      inboxTestIds.conversationId,
      { socialAccountId: inboxTestIds.socialAccountId, body: "First reply" },
      inboxTenantContext,
    );
    await socialInboxReplyService.sendReply(
      inboxTestIds.brandId,
      inboxTestIds.organisationId,
      inboxTestIds.conversationId,
      { socialAccountId: inboxTestIds.socialAccountId, body: "Second reply" },
      inboxTenantContext,
    );

    expect(adapterMock.sendReply).toHaveBeenCalledTimes(2);
    expect(prismaMock.socialMessage.create).toHaveBeenCalledTimes(2);
  });
});
