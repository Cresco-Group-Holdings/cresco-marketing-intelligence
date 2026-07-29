import { beforeEach, describe, expect, it, vi } from "vitest";
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
  },
}));

const aiRequestServiceMock = vi.hoisted(() => ({
  executeText: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/ai-request-service", () => ({
  aiRequestService: aiRequestServiceMock,
}));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({
      id: inboxTestIds.brandId,
      projectId: inboxTestIds.projectId,
    }),
  },
}));
vi.mock("@/server/services/brand-knowledge-service", () => ({
  brandKnowledgeService: {
    getSnapshot: vi.fn().mockResolvedValue({
      brand: { name: "Test Brand" },
      voiceRules: [],
      complianceRules: [{ severity: "HIGH", title: "No guarantees", ruleText: "Avoid guarantees." }],
    }),
  },
}));
vi.mock("@/lib/ai/brand-context-builder", () => ({
  brandContextBuilder: {
    build: vi.fn().mockReturnValue({
      compliance: [{ severity: "HIGH", title: "No guarantees", ruleText: "Avoid guarantees." }],
    }),
  },
}));

vi.mock("@/server/services/social-inbox-reply-service", () => ({
  socialInboxReplyService: {
    sendReply: vi.fn(),
  },
}));

import { inboxReplySuggestionService } from "@/server/services/inbox-reply-suggestion-service";
import { socialInboxReplyService } from "@/server/services/social-inbox-reply-service";

describe("inboxReplySuggestionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.socialConversation.findFirst.mockResolvedValue({
      ...createMockConversation(),
      messages: [
        {
          direction: "INBOUND",
          body: "Do you offer weekend support?",
          providerCreatedAt: new Date("2026-07-29T10:00:00.000Z"),
        },
      ],
      comments: [],
      mentions: [],
    });
    aiRequestServiceMock.executeText.mockResolvedValue({
      output: "  Thanks for reaching out — our team replies on weekdays.  ",
      aiRequestId: "ai-request-123",
      estimatedCostUsd: 0.002,
      provider: "MOCK",
      model: "mock-text-v1",
    });
  });

  it("returns a draft suggestion and never auto-sends", async () => {
    const result = await inboxReplySuggestionService.suggestReply(
      inboxTestIds.brandId,
      inboxTestIds.organisationId,
      inboxTestIds.conversationId,
      { socialAccountId: inboxTestIds.socialAccountId },
      inboxTenantContext,
    );

    expect(result).toEqual({
      draft: "Thanks for reaching out — our team replies on weekdays.",
      aiRequestId: "ai-request-123",
      estimatedCostUsd: 0.002,
      provider: "MOCK",
      model: "mock-text-v1",
      autoSent: false,
    });
    expect(aiRequestServiceMock.executeText).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "INBOX_REPLY_SUGGEST",
        templateKey: "inbox.reply.suggest",
      }),
      inboxTenantContext,
    );
    expect(vi.mocked(socialInboxReplyService.sendReply)).not.toHaveBeenCalled();
  });

  it("instructs the model to draft only and not imply posting", async () => {
    await inboxReplySuggestionService.suggestReply(
      inboxTestIds.brandId,
      inboxTestIds.organisationId,
      inboxTestIds.conversationId,
      { socialAccountId: inboxTestIds.socialAccountId },
      inboxTenantContext,
    );

    const call = aiRequestServiceMock.executeText.mock.calls[0][0];
    expect(call.userInput).toContain("Return reply text only");
    expect(call.userInput).toContain("Do not send or imply the message was posted");
  });

  it("rejects suggestions when the social account does not match", async () => {
    await expect(
      inboxReplySuggestionService.suggestReply(
        inboxTestIds.brandId,
        inboxTestIds.organisationId,
        inboxTestIds.conversationId,
        { socialAccountId: "wrong-account" },
        inboxTenantContext,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(aiRequestServiceMock.executeText).not.toHaveBeenCalled();
  });

  it("returns not found when the conversation is missing", async () => {
    prismaMock.socialConversation.findFirst.mockResolvedValue(null);

    await expect(
      inboxReplySuggestionService.suggestReply(
        inboxTestIds.brandId,
        inboxTestIds.organisationId,
        inboxTestIds.conversationId,
        { socialAccountId: inboxTestIds.socialAccountId },
        inboxTenantContext,
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("does not grant viewers permission to reply via the inbox", () => {
    expect(hasPermission("VIEWER", PERMISSIONS["socialInbox.reply"])).toBe(false);
    expect(hasPermission("MARKETER", PERMISSIONS["socialInbox.reply"])).toBe(true);
  });
});
