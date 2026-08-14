import { z } from "zod";
import { AUTOMATION_ACTION_TYPES, AUTOMATION_EVENT_TYPES } from "@/lib/automation-engine/constants";

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  executionLimitPerDay: z.number().int().positive().optional(),
  monthlyQuota: z.number().int().positive().optional(),
});

export const saveVersionSchema = z.object({
  workflowId: z.string().min(1),
  notes: z.string().max(2000).optional(),
  triggers: z.array(
    z.object({
      triggerKind: z.enum(["EVENT", "SCHEDULE"]),
      eventType: z.enum(AUTOMATION_EVENT_TYPES).optional(),
      scheduleCron: z.string().optional(),
      config: z.record(z.string(), z.unknown()).optional(),
      isEnabled: z.boolean().optional(),
    }),
  ),
  conditions: z.array(
    z.object({
      field: z.string().min(1),
      operator: z.string().min(1),
      value: z.unknown().optional(),
      sortOrder: z.number().int().optional(),
    }),
  ),
  actions: z.array(
    z.object({
      actionType: z.enum(AUTOMATION_ACTION_TYPES),
      config: z.record(z.string(), z.unknown()),
      sortOrder: z.number().int().optional(),
      maxRetries: z.number().int().min(0).max(10).optional(),
      idempotencyKeyTemplate: z.string().optional(),
    }),
  ),
});

export const dispatchEventSchema = z.object({
  eventType: z.enum(AUTOMATION_EVENT_TYPES),
  payload: z.record(z.string(), z.unknown()),
  dryRun: z.boolean().optional(),
  idempotencyKey: z.string().optional(),
});

export const manualExecuteSchema = z.object({
  workflowId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
  dryRun: z.boolean().optional(),
});
