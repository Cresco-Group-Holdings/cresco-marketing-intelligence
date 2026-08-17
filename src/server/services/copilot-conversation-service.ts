import { randomUUID } from "node:crypto";
import type {
  CopilotConversationRecord,
  CopilotMessageRecord,
  CopilotPageContext,
  CopilotResponse,
} from "@/lib/copilot/types";

type StoredConversation = CopilotConversationRecord & {
  organisationId: string;
  userProfileId: string;
  brandId?: string | null;
  pageContext?: CopilotPageContext;
};

const conversations = new Map<string, StoredConversation>();

export const copilotConversationService = {
  async createConversation(input: {
    organisationId: string;
    brandId?: string | null;
    userProfileId: string;
    title: string;
    pageContext?: CopilotPageContext;
  }) {
    const id = randomUUID();
    const now = new Date().toISOString();
    const record: StoredConversation = {
      id,
      organisationId: input.organisationId,
      brandId: input.brandId ?? null,
      userProfileId: input.userProfileId,
      title: input.title.slice(0, 120),
      pageContext: input.pageContext,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    conversations.set(id, record);
    return record;
  },

  async getConversation(conversationId: string, userProfileId: string, organisationId: string) {
    const conversation = conversations.get(conversationId);
    if (!conversation) return null;
    if (conversation.userProfileId !== userProfileId || conversation.organisationId !== organisationId) {
      return null;
    }
    return conversation;
  },

  async listConversations(userProfileId: string, organisationId: string, limit = 20) {
    return [...conversations.values()]
      .filter((item) => item.userProfileId === userProfileId && item.organisationId === organisationId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
      .map((conversation) => ({
        ...conversation,
        messages: conversation.messages.slice(-1),
      }));
  },

  async addMessage(input: {
    conversationId: string;
    role: "user" | "assistant";
    content: string;
    response?: CopilotResponse;
  }) {
    const conversation = conversations.get(input.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found.");
    }
    const message: CopilotMessageRecord = {
      id: randomUUID(),
      role: input.role,
      content: input.content,
      response: input.response,
      createdAt: new Date().toISOString(),
    };
    conversation.messages.push(message);
    conversation.updatedAt = message.createdAt;
    conversations.set(conversation.id, conversation);
    return message;
  },

  toRecord(conversation: StoredConversation): CopilotConversationRecord {
    return {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages,
    };
  },

  /** Test helper */
  _resetStore() {
    conversations.clear();
  },
};
