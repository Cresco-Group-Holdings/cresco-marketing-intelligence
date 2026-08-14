import type { InboxItemStatus, InboxSection, NotificationCategory } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { eventTypeToSection } from "@/lib/collaboration/inbox-sections";
import type { TenantContext } from "@/lib/tenancy/context";
import { assertOrganisationScope } from "@/lib/tenancy/context";

export type CreateInboxItemInput = {
  organisationId: string;
  userId: string;
  category: NotificationCategory;
  eventType: string;
  title: string;
  message: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  sourceEntityType?: string;
  sourceEntityId?: string;
  actionUrl?: string;
  notificationId?: string;
  assignedToUserId?: string;
  idempotencyKey: string;
};

function toSafeInboxItem(item: {
  id: string;
  section: InboxSection;
  category: NotificationCategory;
  title: string;
  message: string;
  priority: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  actionUrl: string | null;
  status: InboxItemStatus;
  assignedToUserId: string | null;
  readAt: Date | null;
  dismissedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: item.id,
    section: item.section,
    category: item.category,
    title: item.title,
    message: item.message,
    priority: item.priority,
    sourceEntityType: item.sourceEntityType,
    sourceEntityId: item.sourceEntityId,
    actionUrl: item.actionUrl,
    status: item.status,
    assignedToUserId: item.assignedToUserId,
    readAt: item.readAt?.toISOString() ?? null,
    dismissedAt: item.dismissedAt?.toISOString() ?? null,
    archivedAt: item.archivedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
  };
}

export const unifiedInboxService = {
  async upsertFromNotification(input: CreateInboxItemInput) {
    const section = eventTypeToSection(input.eventType, input.category);
    const existing = await prisma.inboxItem.findUnique({
      where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } },
    });
    if (existing) return existing;

    return prisma.inboxItem.create({
      data: {
        organisationId: input.organisationId,
        userId: input.userId,
        section,
        category: input.category,
        title: input.title,
        message: input.message,
        priority: input.priority ?? "NORMAL",
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
        actionUrl: input.actionUrl,
        notificationId: input.notificationId,
        assignedToUserId: input.assignedToUserId,
        idempotencyKey: input.idempotencyKey,
        status: "UNREAD",
      },
    });
  },

  async list(
    organisationId: string,
    userId: string,
    context: TenantContext,
    filters: {
      section?: InboxSection;
      unreadOnly?: boolean;
      cursor?: string;
      limit?: number;
    },
  ) {
    assertOrganisationScope(organisationId, context);
    const limit = Math.min(filters.limit ?? 25, 100);

    const items = await prisma.inboxItem.findMany({
      where: {
        organisationId,
        userId,
        archivedAt: null,
        ...(filters.section && filters.section !== "ALL" ? { section: filters.section } : {}),
        ...(filters.section === "ASSIGNED" ? { assignedToUserId: userId } : {}),
        ...(filters.unreadOnly ? { status: "UNREAD" } : { status: { not: "ARCHIVED" } }),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;

    return {
      items: page.map(toSafeInboxItem),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
  },

  async unreadCount(organisationId: string, userId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    return prisma.inboxItem.count({
      where: { organisationId, userId, status: "UNREAD", archivedAt: null },
    });
  },

  async markRead(organisationId: string, userId: string, itemId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    const item = await prisma.inboxItem.findFirst({
      where: { id: itemId, organisationId, userId },
    });
    if (!item) throw new AppError("NOT_FOUND", "Inbox item not found.");
    return prisma.inboxItem.update({
      where: { id: itemId },
      data: { status: "READ", readAt: new Date() },
    });
  },

  async markAllRead(organisationId: string, userId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    const result = await prisma.inboxItem.updateMany({
      where: { organisationId, userId, status: "UNREAD" },
      data: { status: "READ", readAt: new Date() },
    });
    return { updated: result.count };
  },

  async dismiss(organisationId: string, userId: string, itemId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    const item = await prisma.inboxItem.findFirst({
      where: { id: itemId, organisationId, userId },
    });
    if (!item) throw new AppError("NOT_FOUND", "Inbox item not found.");
    return prisma.inboxItem.update({
      where: { id: itemId },
      data: { status: "DISMISSED", dismissedAt: new Date() },
    });
  },

  async archive(organisationId: string, userId: string, itemId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    const item = await prisma.inboxItem.findFirst({
      where: { id: itemId, organisationId, userId },
    });
    if (!item) throw new AppError("NOT_FOUND", "Inbox item not found.");
    return prisma.inboxItem.update({
      where: { id: itemId },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
  },

  async bulkAction(
    organisationId: string,
    userId: string,
    itemIds: string[],
    action: "read" | "dismiss" | "archive",
    context: TenantContext,
  ) {
    assertOrganisationScope(organisationId, context);
    const data =
      action === "read"
        ? { status: "READ" as const, readAt: new Date() }
        : action === "dismiss"
          ? { status: "DISMISSED" as const, dismissedAt: new Date() }
          : { status: "ARCHIVED" as const, archivedAt: new Date() };

    const result = await prisma.inboxItem.updateMany({
      where: { id: { in: itemIds }, organisationId, userId },
      data,
    });
    return { updated: result.count };
  },
};
