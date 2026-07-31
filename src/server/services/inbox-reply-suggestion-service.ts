import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { aiRequestService } from "@/server/services/ai-request-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { brandService } from "@/server/services/workspace-service";

function buildConversationHistory(input: {
  messages: Array<{ direction: string; body: string; providerCreatedAt: Date }>;
  comments: Array<{ body: string; providerCreatedAt: Date }>;
  mentions: Array<{ body: string; providerCreatedAt: Date }>;
}): string {
  const lines: string[] = [];
  for (const message of input.messages) {
    lines.push(
      `[${message.providerCreatedAt.toISOString()}] ${message.direction}: ${message.body}`,
    );
  }
  for (const comment of input.comments) {
    lines.push(`[${comment.providerCreatedAt.toISOString()}] COMMENT: ${comment.body}`);
  }
  for (const mention of input.mentions) {
    lines.push(`[${mention.providerCreatedAt.toISOString()}] MENTION: ${mention.body}`);
  }
  return lines.join("\n");
}

export const inboxReplySuggestionService = {
  /**
   * Generates a reply draft suggestion only — never sends to the provider.
   */
  async suggestReply(
    brandId: string,
    organisationId: string,
    conversationId: string,
    input: { socialAccountId: string; requestId?: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const conversation = await prisma.socialConversation.findFirst({
      where: {
        id: conversationId,
        organisationId,
        brandId,
        socialAccountId: input.socialAccountId,
      },
      include: {
        messages: { orderBy: { providerCreatedAt: "asc" }, take: 30 },
        comments: { orderBy: { providerCreatedAt: "asc" }, take: 30 },
        mentions: { orderBy: { providerCreatedAt: "asc" }, take: 30 },
      },
    });
    if (!conversation) {
      throw new AppError("NOT_FOUND", "Conversation was not found.");
    }
    if (conversation.socialAccountId !== input.socialAccountId) {
      throw new AppError(
        "FORBIDDEN",
        "The selected social account does not match this conversation.",
      );
    }

    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, context);
    const brandContext = brandContextBuilder.build(snapshot, {
      contentPillar: conversation.summary ?? undefined,
    });
    const complianceRules = brandContext.compliance
      .map((rule) => `- [${rule.severity}] ${rule.title}: ${rule.ruleText}`)
      .join("\n");
    const history = buildConversationHistory(conversation);

    const userInput = [
      "Draft a concise, on-brand reply to the conversation below.",
      "Return reply text only. Do not send or imply the message was posted.",
      "",
      "Compliance rules:",
      complianceRules || "Follow brand voice and avoid unsupported claims.",
      "",
      "Conversation history:",
      history || "(no prior messages)",
    ].join("\n");

    const result = await aiRequestService.executeText(
      {
        organisationId,
        projectId: brand.projectId,
        brandId,
        userProfileId: context.userProfileId,
        purpose: "INBOX_REPLY_SUGGEST",
        templateKey: "inbox.reply.suggest",
        userInput,
        brandContext: brandContext as unknown as Record<string, unknown>,
        requestId: input.requestId,
      },
      context,
    );

    return {
      draft: String(result.output).trim(),
      aiRequestId: result.aiRequestId,
      estimatedCostUsd: result.estimatedCostUsd,
      provider: result.provider,
      model: result.model,
      autoSent: false as const,
    };
  },
};
