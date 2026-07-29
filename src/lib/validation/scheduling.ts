import { z } from "zod";
export const scheduleCreateSchema = z.object({ contentVariantId: z.string(), socialAccountId: z.string(), scheduledFor: z.string().datetime(), timezone: z.string().min(1).max(80), recurrence: z.object({ weekdays: z.array(z.number().int().min(0).max(6)).max(7), endDate: z.string().datetime().optional(), maxOccurrences: z.number().int().min(1).max(52).default(1) }).optional() });
export type ScheduleCreateInput = z.infer<typeof scheduleCreateSchema>;
