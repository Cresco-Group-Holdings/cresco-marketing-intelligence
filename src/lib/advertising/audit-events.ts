import type { Prisma } from "@prisma/client";
import { recordAuditEvent } from "@/server/services/audit-service";
import { incrementAdvertisingCounter, ADVERTISING_METRIC_NAMES } from "./observability";

export type AdvertisingAuditAction =
  | "advertising.launch.approved"
  | "advertising.launch.executed"
  | "advertising.launch.failed"
  | "advertising.mutation.blocked"
  | "advertising.budget.change_requested"
  | "advertising.budget.change_approved"
  | "advertising.budget.emergency_pause"
  | "advertising.budget.emergency_resolved"
  | "advertising.optimisation.run_completed"
  | "advertising.optimisation.action_approved"
  | "advertising.optimisation.action_blocked"
  | "advertising.experiment.decided"
  | "advertising.unauthorised_access";

export async function recordAdvertisingAuditEvent(input: {
  organisationId: string;
  projectId?: string;
  actorUserId?: string;
  action: AdvertisingAuditAction;
  resourceType: string;
  resourceId?: string;
  requestId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  if (input.action === "advertising.unauthorised_access") {
    incrementAdvertisingCounter(ADVERTISING_METRIC_NAMES.unauthorisedMutationAttempts);
  }
  if (input.action === "advertising.budget.emergency_pause") {
    incrementAdvertisingCounter(ADVERTISING_METRIC_NAMES.emergencyPauses);
  }
  if (input.action === "advertising.launch.executed") {
    incrementAdvertisingCounter(ADVERTISING_METRIC_NAMES.launchSuccess);
  }
  if (input.action === "advertising.launch.failed") {
    incrementAdvertisingCounter(ADVERTISING_METRIC_NAMES.launchFailure);
  }
  if (input.action === "advertising.mutation.blocked") {
    incrementAdvertisingCounter(ADVERTISING_METRIC_NAMES.unauthorisedMutationAttempts);
  }

  return recordAuditEvent({
    organisationId: input.organisationId,
    projectId: input.projectId,
    actorUserId: input.actorUserId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    requestId: input.requestId,
    metadata: input.metadata,
  });
}
