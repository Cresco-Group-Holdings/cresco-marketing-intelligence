import type {
  Prisma,
  SocialConversationStatus,
  SocialConversationType,
  SocialInboxPriority,
  SocialProvider,
  SocialSafetyFlag,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { assertOrganisationScope, type TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export type ConversationFilters = {
  status?: SocialConversationStatus;
  conversationType?: SocialConversationType;
  provider?: SocialProvider;
  socialAccountId?: string;
  unread?: boolean;
  search?: string;
  assigneeUserId?: string;
  tags?: string[];
  priority?: SocialInboxPriority;
  requiresHumanReview?: boolean;
  safetyFlag?: SocialSafetyFlag;
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: string;
};

export type ConversationSummary = {
  total: number;
  unread: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
};

function buildWhere(
  brandId: string,
  organisationId: string,
  filters: ConversationFilters,
): Prisma.SocialConversationWhereInput {
  return {
    organisationId,
    brandId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.conversationType ? { conversationType: filters.conversationType } : {}),
    ...(filters.provider ? { provider: filters.provider } : {}),
    ...(filters.socialAccountId ? { socialAccountId: filters.socialAccountId } : {}),
    ...(filters.unread ? { unreadCount: { gt: 0 } } : {}),
    ...(filters.assigneeUserId ? { assignedToUserId: filters.assigneeUserId } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.requiresHumanReview !== undefined
      ? { requiresHumanReview: filters.requiresHumanReview }
      : {}),
    ...(filters.safetyFlag ? { safetyFlags: { has: filters.safetyFlag } } : {}),
    ...(filters.from || filters.to
      ? {
          lastMessageAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
    ...(filters.tags?.length
      ? { tags: { some: { tag: { in: filters.tags } } } }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { subject: { contains: filters.search, mode: "insensitive" } },
            { summary: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export const socialInboxQueryService = {
  async listConversations(
    brandId: string,
    organisationId: string,
    filters: ConversationFilters,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

    const conversations = await prisma.socialConversation.findMany({
      where: buildWhere(brandId, organisationId, filters),
      include: {
        assignedTo: { select: { id: true, displayName: true, email: true } },
        tags: { select: { tag: true } },
        socialAccount: {
          select: { id: true, username: true, displayName: true, provider: true },
        },
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const hasMore = conversations.length > limit;
    const items = hasMore ? conversations.slice(0, limit) : conversations;

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    };
  },

  async getConversation(
    brandId: string,
    organisationId: string,
    conversationId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);

    const conversation = await prisma.socialConversation.findFirst({
      where: { id: conversationId, organisationId, brandId },
      include: {
        assignedTo: { select: { id: true, displayName: true, email: true } },
        tags: true,
        assignments: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            assignedTo: { select: { id: true, displayName: true, email: true } },
            assignedBy: { select: { id: true, displayName: true, email: true } },
          },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { changedBy: { select: { id: true, displayName: true, email: true } } },
        },
        messages: {
          orderBy: { providerCreatedAt: "asc" },
          include: {
            participant: true,
            sentBy: { select: { id: true, displayName: true, email: true } },
          },
        },
        comments: {
          orderBy: { providerCreatedAt: "asc" },
          include: { participant: true },
        },
        mentions: {
          orderBy: { providerCreatedAt: "asc" },
          include: { participant: true },
        },
        socialAccount: {
          select: { id: true, username: true, displayName: true, provider: true },
        },
      },
    });

    if (!conversation) {
      throw new AppError("NOT_FOUND", "Conversation was not found.");
    }

    assertOrganisationScope(conversation.organisationId, context);

    const postPreview = await resolvePostPreview(conversation);

    if (conversation.unreadCount > 0) {
      await prisma.socialConversation.update({
        where: { id: conversation.id },
        data: { unreadCount: 0 },
      });
    }

    return { ...conversation, postPreview, unreadCount: 0 };
  },

  async getSummary(
    brandId: string,
    organisationId: string,
    filters: Pick<ConversationFilters, "socialAccountId" | "provider">,
    context: TenantContext,
  ): Promise<ConversationSummary> {
    await brandService.getById(brandId, organisationId, context);
    const where = buildWhere(brandId, organisationId, filters);

    const [total, unread, statusGroups, typeGroups] = await Promise.all([
      prisma.socialConversation.count({ where }),
      prisma.socialConversation.count({ where: { ...where, unreadCount: { gt: 0 } } }),
      prisma.socialConversation.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      prisma.socialConversation.groupBy({
        by: ["conversationType"],
        where,
        _count: { _all: true },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const group of statusGroups) {
      byStatus[group.status] = group._count._all;
    }
    const byType: Record<string, number> = {};
    for (const group of typeGroups) {
      byType[group.conversationType] = group._count._all;
    }

    return { total, unread, byStatus, byType };
  },
};

async function resolvePostPreview(conversation: {
  relatedProviderPostId: string | null;
  relatedContentItemId: string | null;
  organisationId: string;
  brandId: string;
}) {
  if (conversation.relatedContentItemId) {
    const item = await prisma.contentItem.findFirst({
      where: {
        id: conversation.relatedContentItemId,
        organisationId: conversation.organisationId,
        brandId: conversation.brandId,
      },
      select: {
        id: true,
        title: true,
        contentType: true,
        primaryMessage: true,
        variants: {
          take: 1,
          select: { caption: true, headline: true },
        },
      },
    });
    if (item) {
      const variant = item.variants[0];
      return {
        source: "PLATFORM" as const,
        contentItemId: item.id,
        title: item.title,
        contentType: item.contentType,
        caption: variant?.caption ?? variant?.headline ?? item.primaryMessage ?? null,
      };
    }
  }

  if (conversation.relatedProviderPostId) {
    return {
      source: "PROVIDER" as const,
      providerPostId: conversation.relatedProviderPostId,
    };
  }

  return null;
}
