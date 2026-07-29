import { beforeEach, describe, expect, it, vi } from "vitest";
import { inboxAccountScope } from "../helpers/inbox-mocks";
import { socialInboxIngestService } from "@/server/services/social-inbox-ingest-service";

const prismaMock = vi.hoisted(() => ({
  socialInboxWebhookEvent: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
  socialParticipant: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  socialConversation: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  socialMessage: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  socialComment: {
    upsert: vi.fn(),
  },
  socialMention: {
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));

describe("socialInboxIngestService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.socialInboxWebhookEvent.findFirst.mockResolvedValue(null);
    prismaMock.socialInboxWebhookEvent.upsert.mockResolvedValue({});
    prismaMock.socialParticipant.upsert.mockImplementation(async (args: { create: { providerParticipantId: string } }) => ({
      id: `participant-${args.create.providerParticipantId}`,
    }));
    prismaMock.socialConversation.findUnique.mockResolvedValue(null);
    prismaMock.socialConversation.upsert.mockImplementation(
      async (args: { create: { providerConversationId: string; safetyFlags?: string[]; requiresHumanReview?: boolean } }) => ({
        id: `conv-${args.create.providerConversationId}`,
        safetyFlags: args.create.safetyFlags ?? [],
        requiresHumanReview: args.create.requiresHumanReview ?? false,
      }),
    );
    prismaMock.socialConversation.update.mockResolvedValue({});
    prismaMock.socialMessage.findUnique.mockResolvedValue(null);
    prismaMock.socialMessage.upsert.mockImplementation(
      async (args: { create: { providerMessageId: string; body: string; isDeleted?: boolean; isEdited?: boolean } }) => ({
        id: `msg-${args.create.providerMessageId}`,
        body: args.create.body,
        isDeleted: args.create.isDeleted ?? false,
        isEdited: args.create.isEdited ?? false,
      }),
    );
    prismaMock.socialComment.upsert.mockImplementation(
      async (args: { create: { providerCommentId: string; body: string; isDeleted?: boolean } }) => ({
        id: `comment-${args.create.providerCommentId}`,
        body: args.create.body,
        isDeleted: args.create.isDeleted ?? false,
      }),
    );
    prismaMock.socialMention.upsert.mockResolvedValue({ id: "mention-1" });
  });

  it("skips duplicate batches with the same idempotency key", async () => {
    prismaMock.socialInboxWebhookEvent.findFirst.mockResolvedValue({
      id: "processed-marker",
      status: "PROCESSED",
    });

    const first = await socialInboxIngestService.ingestBatch(inboxAccountScope, {
      idempotencyKey: "batch-duplicate-test",
      comments: [
        {
          providerCommentId: "c-1",
          providerPostId: "post-1",
          body: "Hello",
          providerCreatedAt: new Date(),
        },
      ],
    });

    expect(first.skipped).toBe(true);
    expect(first.commentsUpserted).toBe(0);
    expect(prismaMock.socialComment.upsert).not.toHaveBeenCalled();
  });

  it("stores deleted comments with a placeholder body", async () => {
    await socialInboxIngestService.ingestBatch(inboxAccountScope, {
      idempotencyKey: "batch-deleted-comment",
      comments: [
        {
          providerCommentId: "c-deleted",
          providerPostId: "post-1",
          body: "Original text",
          isDeleted: true,
          providerCreatedAt: new Date(),
        },
      ],
    });

    expect(prismaMock.socialComment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ body: "[deleted]", isDeleted: true }),
        update: expect.objectContaining({ body: "[deleted]", isDeleted: true }),
      }),
    );
  });

  it("updates edited comments on re-ingest", async () => {
    prismaMock.socialMessage.findUnique.mockResolvedValue({
      id: "msg-existing",
      isEdited: false,
      isDeleted: false,
    });

    await socialInboxIngestService.ingestBatch(inboxAccountScope, {
      idempotencyKey: "batch-edited-message",
      messages: [
        {
          providerMessageId: "m-edited",
          providerConversationId: "dm-1",
          direction: "INBOUND",
          body: "Updated message body",
          isEdited: true,
          providerCreatedAt: new Date(),
          providerEditedAt: new Date(),
        },
      ],
    });

    expect(prismaMock.socialMessage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          body: "Updated message body",
          isEdited: true,
        }),
      }),
    );
  });

  it("does not re-upsert unchanged messages", async () => {
    prismaMock.socialMessage.findUnique.mockResolvedValue({
      id: "msg-existing",
      isEdited: false,
      isDeleted: false,
    });

    const result = await socialInboxIngestService.ingestBatch(inboxAccountScope, {
      idempotencyKey: "batch-unchanged-message",
      messages: [
        {
          providerMessageId: "m-unchanged",
          providerConversationId: "dm-2",
          direction: "INBOUND",
          body: "Same body",
          providerCreatedAt: new Date(),
        },
      ],
    });

    expect(result.messagesUpserted).toBe(1);
    expect(prismaMock.socialMessage.upsert).not.toHaveBeenCalled();
  });

  it("applies safety flags to conversations from inbound text", async () => {
    await socialInboxIngestService.ingestBatch(inboxAccountScope, {
      idempotencyKey: "batch-safety-flags",
      comments: [
        {
          providerCommentId: "c-threat",
          providerPostId: "post-1",
          body: "I will sue you unless I get a refund — call 555-123-4567",
          providerCreatedAt: new Date(),
        },
      ],
    });

    expect(prismaMock.socialConversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          safetyFlags: expect.arrayContaining(["THREAT", "COMPLAINT_REVIEW", "PERSONAL_DATA"]),
          requiresHumanReview: true,
        }),
      }),
    );

    expect(prismaMock.socialConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          safetyFlags: expect.arrayContaining(["THREAT", "COMPLAINT_REVIEW", "PERSONAL_DATA"]),
          requiresHumanReview: true,
        }),
      }),
    );
  });
});
