import { CalendarEventStatus, CalendarEventType } from "@prisma/client";
import { z } from "zod";
import { CALENDAR_VIEW_MODES } from "@/lib/calendar/constants";

const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const calendarListFiltersSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  view: z.enum(CALENDAR_VIEW_MODES).optional(),
  projectId: z.string().optional(),
  brandId: z.string().optional(),
  campaignId: z.string().optional(),
  channel: z.string().trim().max(64).optional(),
  types: z
    .union([
      z.nativeEnum(CalendarEventType),
      z.array(z.nativeEnum(CalendarEventType)),
    ])
    .optional()
    .transform((value) => (value == null ? undefined : Array.isArray(value) ? value : [value])),
  status: z.nativeEnum(CalendarEventStatus).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
});

export const calendarCreateSchema = z.object({
  brandId: z.string(),
  projectId: z.string().optional(),
  campaignId: z.string().optional().nullable(),
  contentItemId: z.string().optional().nullable(),
  title: z.string().trim().min(1).max(300),
  description: optionalTrimmed(5000),
  type: z.nativeEnum(CalendarEventType).optional(),
  status: z.nativeEnum(CalendarEventStatus).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
  allDay: z.boolean().optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  color: optionalTrimmed(32),
  location: optionalTrimmed(500),
  channelType: optionalTrimmed(64),
  metadata: z.record(z.unknown()).optional(),
});

export const calendarUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    description: optionalTrimmed(5000).nullable(),
    status: z.nativeEnum(CalendarEventStatus).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional().nullable(),
    allDay: z.boolean().optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    color: optionalTrimmed(32).nullable(),
    location: optionalTrimmed(500).nullable(),
    channelType: optionalTrimmed(64).nullable(),
    metadata: z.record(z.unknown()).optional().nullable(),
    version: z.number().int().positive(),
  })
  .refine((value) => Object.keys(value).length > 1, {
    message: "At least one field must be provided.",
  });

export const calendarRescheduleSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
  allDay: z.boolean().optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  version: z.number().int().positive(),
});

export const calendarUpcomingFiltersSchema = z.object({
  brandId: z.string().optional(),
  projectId: z.string().optional(),
  campaignId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const calendarUnscheduledFiltersSchema = z.object({
  brandId: z.string(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const calendarOverdueFiltersSchema = z.object({
  brandId: z.string().optional(),
  projectId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const calendarConflictsFiltersSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  brandId: z.string().optional(),
  channel: z.string().trim().max(64).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
});

export type CalendarListFilters = z.infer<typeof calendarListFiltersSchema>;
export type CalendarCreateInput = z.infer<typeof calendarCreateSchema>;
export type CalendarUpdateInput = z.infer<typeof calendarUpdateSchema>;
export type CalendarRescheduleInput = z.infer<typeof calendarRescheduleSchema>;
