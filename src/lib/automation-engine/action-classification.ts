import type { AutomationActionType } from "./constants";

export type AutomationActionClassification =
  | "executable"
  | "approval_required"
  | "recommendation_only"
  | "not_implemented";

/** Production classification for automation action types — used by UI and executor. */
export const AUTOMATION_ACTION_CLASSIFICATION: Record<
  AutomationActionType,
  AutomationActionClassification
> = {
  CREATE_TASK: "executable",
  UPDATE_CAMPAIGN_STATUS: "approval_required",
  ASSIGN_USER: "executable",
  REQUEST_APPROVAL: "approval_required",
  CREATE_NOTIFICATION: "executable",
  ADD_CRM_ACTIVITY: "executable",
  UPDATE_LEAD_STATUS: "executable",
  CREATE_CALENDAR_EVENT: "executable",
};

export function isExecutableAction(actionType: AutomationActionType): boolean {
  return AUTOMATION_ACTION_CLASSIFICATION[actionType] === "executable";
}

export function isRecommendationOnlyAction(actionType: AutomationActionType): boolean {
  return AUTOMATION_ACTION_CLASSIFICATION[actionType] === "recommendation_only";
}
