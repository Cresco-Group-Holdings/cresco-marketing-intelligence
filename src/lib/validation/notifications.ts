import {
  NotificationCategory,
  NotificationChannel,
  NotificationDeliveryMode,
  NotificationPriority,
  OperationalAlertType,
  RecoveryActionType,
} from "@prisma/client";
import { z } from "zod";
import {
  NOTIFICATION_DEFAULT_LIST_LIMIT,
  NOTIFICATION_MAX_LIST_LIMIT,
} from "@/lib/notifications/constants";

export const notificationListFiltersSchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  category: z.nativeEnum(NotificationCategory).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(NOTIFICATION_MAX_LIST_LIMIT)
    .default(NOTIFICATION_DEFAULT_LIST_LIMIT),
  cursor: z.string().optional(),
});

export const notificationPreferenceSchema = z.object({
  brandId: z.string().optional().nullable(),
  category: z.nativeEnum(NotificationCategory),
  channel: z.nativeEnum(NotificationChannel),
  enabled: z.coerce.boolean().optional(),
  deliveryMode: z.nativeEnum(NotificationDeliveryMode).optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  timezone: z.string().max(64).optional(),
});

export const operationalAlertFiltersSchema = z.object({
  status: z.string().optional(),
  alertType: z.nativeEnum(OperationalAlertType).optional(),
  brandId: z.string().optional(),
  provider: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});

export const recoveryActionSchema = z.object({
  actionType: z.nativeEnum(RecoveryActionType),
  idempotencyKey: z.string().min(12).max(160),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
});

export const emitNotificationSchema = z.object({
  eventType: z.string(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  actionPath: z.string().optional(),
  brandId: z.string().optional(),
  projectId: z.string().optional(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  recipientUserIds: z.array(z.string()).min(1),
  idempotencyKey: z.string().min(12).max(160),
});

export type NotificationListFilters = z.infer<typeof notificationListFiltersSchema>;
export type NotificationPreferenceInput = z.infer<typeof notificationPreferenceSchema>;
export type OperationalAlertFilters = z.infer<typeof operationalAlertFiltersSchema>;
export type RecoveryActionInput = z.infer<typeof recoveryActionSchema>;
