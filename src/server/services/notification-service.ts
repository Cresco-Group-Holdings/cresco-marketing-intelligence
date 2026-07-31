import type {
  NotificationCategory,
  NotificationChannel,
  NotificationDeliveryMode,
  NotificationPriority,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  buildSafeEmailPayload,
  buildSafeInternalLink,
  stripSensitiveSocialContent,
} from "@/lib/notifications/email-security";
import { getEmailProvider } from "@/lib/notifications/email-provider";
import {
  CRITICAL_NOTIFICATION_CATEGORIES,
  EVENT_CATEGORY_MAP,
  EVENT_PRIORITY_MAP,
  type NotificationEventType,
} from "@/lib/notifications/constants";
import { isWithinQuietHours } from "@/lib/notifications/quiet-hours";
import type { NotificationListFilters } from "@/lib/validation/notifications";
import { assertOrganisationScope, type TenantContext } from "@/lib/tenancy/context";

export type EmitNotificationInput = {
  organisationId: string;
  projectId?: string;
  brandId?: string;
  eventType: NotificationEventType | string;
  title: string;
  body: string;
  resourceType?: string;
  resourceId?: string;
  actionPath?: string;
  priority?: NotificationPriority;
  recipientUserIds: string[];
  idempotencyKey: string;
};

async function getPreference(
  userId: string,
  organisationId: string,
  category: NotificationCategory,
  channel: NotificationChannel,
  brandId?: string,
) {
  return prisma.notificationPreference.findFirst({
    where: {
      userId,
      organisationId,
      category,
      channel,
      OR: [{ brandId: brandId ?? null }, { brandId: null }],
    },
    orderBy: { brandId: "desc" },
  });
}

export const notificationService = {
  async emit(input: EmitNotificationInput) {
    const category =
      EVENT_CATEGORY_MAP[input.eventType as NotificationEventType] ?? "SYSTEM";
    const priority =
      input.priority ??
      EVENT_PRIORITY_MAP[input.eventType as NotificationEventType] ??
      "NORMAL";
    const safeBody = stripSensitiveSocialContent(input.body);
    const actionUrl = input.actionPath ? buildSafeInternalLink(input.actionPath) : null;
    const created = [];

    for (const userId of input.recipientUserIds) {
      const perUserKey = `${input.idempotencyKey}:${userId}`;
      const existing = await prisma.notification.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: perUserKey } },
      });
      if (existing) {
        created.push({ notification: existing, duplicate: true });
        continue;
      }

      const notification = await prisma.notification.create({
        data: {
          organisationId: input.organisationId,
          projectId: input.projectId,
          brandId: input.brandId,
          userId,
          category,
          eventType: input.eventType,
          title: input.title,
          body: input.body,
          safeBody,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          actionUrl,
          priority,
          idempotencyKey: perUserKey,
        },
      });

      await prisma.notificationDelivery.create({
        data: { notificationId: notification.id, channel: "IN_APP", status: "SENT", sentAt: new Date() },
      });

      const pref = await getPreference(userId, input.organisationId, category, "EMAIL", input.brandId);
      const isCritical = CRITICAL_NOTIFICATION_CATEGORIES.includes(category);
      const enabled = isCritical ? true : pref?.enabled ?? true;
      const mode = pref?.deliveryMode ?? "IMMEDIATE";
      const inQuietHours =
        !isCritical &&
        isWithinQuietHours({
          timezone: pref?.timezone,
          quietHoursStart: pref?.quietHoursStart,
          quietHoursEnd: pref?.quietHoursEnd,
        });

      if (!enabled) {
        await prisma.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            channel: "EMAIL",
            status: "SUPPRESSED",
          },
        });
      } else if (mode !== "IMMEDIATE" || inQuietHours) {
        await prisma.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            channel: mode === "DIGEST_WEEKLY" ? "DIGEST_WEEKLY" : "DIGEST_DAILY",
            status: "PENDING",
          },
        });
      } else {
        const org = await prisma.organisation.findUnique({
          where: { id: input.organisationId },
          select: { name: true },
        });
        const profile = await prisma.userProfile.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        if (profile?.email) {
          const emailPayload = buildSafeEmailPayload({
            subject: input.title,
            body: safeBody,
            organisationName: org?.name ?? "Cresco",
            actionPath: input.actionPath,
            allowUnsubscribe: !isCritical,
            userId,
            organisationId: input.organisationId,
          });
          const result = await getEmailProvider().send({ ...emailPayload, to: profile.email });
          await prisma.notificationDelivery.create({
            data: {
              notificationId: notification.id,
              channel: "EMAIL",
              status: result.status === "SENT" ? "SENT" : "FAILED",
              externalId: result.externalId,
              errorMessage: result.errorMessage,
              sentAt: result.status === "SENT" ? new Date() : undefined,
            },
          });
        }
      }

      created.push({ notification, duplicate: false });
    }

    return created;
  },

  async listForUser(
    organisationId: string,
    userId: string,
    filters: NotificationListFilters,
    context: TenantContext,
  ) {
    assertOrganisationScope(organisationId, context);
    const limit = filters.limit ?? 25;
    const items = await prisma.notification.findMany({
      where: {
        organisationId,
        userId,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.unreadOnly ? { readAt: null, dismissedAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return { items: page, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null };
  },

  async markRead(organisationId: string, userId: string, notificationId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, organisationId, userId },
    });
    if (!notification) throw new AppError("NOT_FOUND", "Notification was not found.");
    return prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  },

  async unreadCount(organisationId: string, userId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    return prisma.notification.count({
      where: { organisationId, userId, readAt: null, dismissedAt: null },
    });
  },
};

export const notificationPreferenceService = {
  async upsert(
    organisationId: string,
    userId: string,
    input: {
      brandId?: string | null;
      category: NotificationCategory;
      channel: NotificationChannel;
      enabled?: boolean;
      deliveryMode?: NotificationDeliveryMode;
      quietHoursStart?: string | null;
      quietHoursEnd?: string | null;
      timezone?: string;
    },
    context: TenantContext,
  ) {
    assertOrganisationScope(organisationId, context);
    const isCritical = CRITICAL_NOTIFICATION_CATEGORIES.includes(input.category);
    const enabled = isCritical ? true : input.enabled ?? true;

    const brandId = input.brandId ?? null;
    const existing = await prisma.notificationPreference.findFirst({
      where: {
        userId,
        organisationId,
        brandId,
        category: input.category,
        channel: input.channel,
      },
    });

    const data = {
      enabled,
      deliveryMode: input.deliveryMode ?? "IMMEDIATE",
      quietHoursStart: input.quietHoursStart,
      quietHoursEnd: input.quietHoursEnd,
      timezone: input.timezone ?? "UTC",
      isCriticalLocked: isCritical,
    };

    if (existing) {
      return prisma.notificationPreference.update({
        where: { id: existing.id },
        data,
      });
    }

    return prisma.notificationPreference.create({
      data: {
        organisationId,
        userId,
        brandId,
        category: input.category,
        channel: input.channel,
        ...data,
      },
    });
  },

  async list(organisationId: string, userId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    return prisma.notificationPreference.findMany({
      where: { organisationId, userId },
      orderBy: [{ category: "asc" }, { channel: "asc" }],
    });
  },
};

export const notificationDigestService = {
  async processDue(period: "DIGEST_DAILY" | "DIGEST_WEEKLY") {
    const pending = await prisma.notificationDelivery.findMany({
      where: {
        channel: period,
        status: "PENDING",
        digestId: null,
      },
      include: { notification: true },
      take: 500,
    });

    const grouped = new Map<string, typeof pending>();
    for (const delivery of pending) {
      const key = `${delivery.notification.organisationId}:${delivery.notification.userId}`;
      const list = grouped.get(key) ?? [];
      list.push(delivery);
      grouped.set(key, list);
    }

    const results = [];
    for (const [key, deliveries] of grouped) {
      const [organisationId, userId] = key.split(":");
      const digest = await prisma.notificationDigest.create({
        data: {
          organisationId,
          userId,
          channel: period,
          periodStart: new Date(Date.now() - (period === "DIGEST_WEEKLY" ? 7 : 1) * 86_400_000),
          periodEnd: new Date(),
          itemCount: deliveries.length,
          sentAt: new Date(),
        },
      });

      await prisma.notificationDelivery.updateMany({
        where: { id: { in: deliveries.map((d) => d.id) } },
        data: { digestId: digest.id, status: "SENT", sentAt: new Date() },
      });
      results.push(digest);
    }
    return results;
  },
};
