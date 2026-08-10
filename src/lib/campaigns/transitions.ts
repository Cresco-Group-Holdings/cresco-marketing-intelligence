import type { CampaignStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { CAMPAIGN_STATUS_TRANSITIONS } from "@/lib/campaigns/constants";

export type CampaignTransitionAction =
  | "plan"
  | "markReady"
  | "activate"
  | "pause"
  | "resume"
  | "complete"
  | "cancel"
  | "archive"
  | "restore"
  | "reopen";

const ACTION_TARGET_STATUS: Record<CampaignTransitionAction, CampaignStatus> = {
  plan: "PLANNED",
  markReady: "READY",
  activate: "ACTIVE",
  pause: "PAUSED",
  resume: "ACTIVE",
  complete: "COMPLETED",
  cancel: "CANCELLED",
  archive: "ARCHIVED",
  restore: "DRAFT",
  reopen: "PLANNED",
};

const ACTION_SOURCE_STATUSES: Partial<Record<CampaignTransitionAction, CampaignStatus[]>> = {
  plan: ["DRAFT"],
  markReady: ["PLANNED"],
  activate: ["READY"],
  pause: ["ACTIVE"],
  resume: ["PAUSED"],
  complete: ["ACTIVE", "PAUSED"],
  cancel: ["DRAFT", "PLANNED", "READY", "ACTIVE", "PAUSED"],
  archive: ["DRAFT", "PLANNED", "READY", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"],
  restore: ["ARCHIVED"],
  reopen: ["COMPLETED", "CANCELLED"],
};

export function assertTransition(from: CampaignStatus, to: CampaignStatus): void {
  const allowed = CAMPAIGN_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new AppError("VALIDATION_ERROR", `Cannot transition campaign from ${from} to ${to}.`);
  }
}

export function resolveTransitionAction(
  action: CampaignTransitionAction,
  currentStatus: CampaignStatus,
): CampaignStatus {
  const allowedSources = ACTION_SOURCE_STATUSES[action];
  if (allowedSources && !allowedSources.includes(currentStatus)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Cannot perform ${action} while campaign is ${currentStatus}.`,
    );
  }

  const targetStatus = ACTION_TARGET_STATUS[action];
  assertTransition(currentStatus, targetStatus);
  return targetStatus;
}

export function transitionActions(): CampaignTransitionAction[] {
  return [
    "plan",
    "markReady",
    "activate",
    "pause",
    "resume",
    "complete",
    "cancel",
    "archive",
    "restore",
    "reopen",
  ];
}
