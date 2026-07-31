import type { ExitReason } from "./constants";
import { evaluateCondition, type AutomationCondition, type LeadSnapshot } from "./conditions";

export type ExitRule = {
  exitReason: ExitReason;
  config?: Record<string, unknown>;
  evaluateBeforeMessaging?: boolean;
};

export type ExitEvaluationContext = {
  snapshot: LeadSnapshot;
  suppressed: boolean;
  unsubscribed: boolean;
  consentMarketing: boolean;
  subscriptionStarted?: boolean;
  customerConverted?: boolean;
  opportunityLost?: boolean;
  supportIssueOpened?: boolean;
  goalAchieved?: boolean;
  maxDurationReached?: boolean;
  automationStopped?: boolean;
};

export function shouldExitBeforeAction(
  rules: ExitRule[],
  context: ExitEvaluationContext,
): { exit: boolean; reason?: ExitReason } {
  const messagingRules = rules.filter((rule) => rule.evaluateBeforeMessaging !== false);

  for (const rule of messagingRules) {
    switch (rule.exitReason) {
      case "CONSENT_WITHDRAWN":
        if (!context.consentMarketing) {
          return { exit: true, reason: "CONSENT_WITHDRAWN" };
        }
        break;
      case "LEAD_SUPPRESSED":
        if (context.suppressed || context.unsubscribed) {
          return { exit: true, reason: "LEAD_SUPPRESSED" };
        }
        break;
      case "CUSTOMER_CONVERTED":
        if (context.customerConverted) {
          return { exit: true, reason: "CUSTOMER_CONVERTED" };
        }
        break;
      case "SUBSCRIPTION_STARTED":
        if (context.subscriptionStarted) {
          return { exit: true, reason: "SUBSCRIPTION_STARTED" };
        }
        break;
      case "OPPORTUNITY_LOST":
        if (context.opportunityLost) {
          return { exit: true, reason: "OPPORTUNITY_LOST" };
        }
        break;
      case "SUPPORT_ISSUE_OPENED":
        if (context.supportIssueOpened) {
          return { exit: true, reason: "SUPPORT_ISSUE_OPENED" };
        }
        break;
      case "GOAL_ACHIEVED":
        if (context.goalAchieved) {
          return { exit: true, reason: "GOAL_ACHIEVED" };
        }
        break;
      case "MAX_DURATION_REACHED":
        if (context.maxDurationReached) {
          return { exit: true, reason: "MAX_DURATION_REACHED" };
        }
        break;
      case "AUTOMATION_STOPPED":
        if (context.automationStopped) {
          return { exit: true, reason: "AUTOMATION_STOPPED" };
        }
        break;
      case "MANUAL_REMOVAL":
      case "ERROR":
        break;
      default: {
        const conditions = rule.config?.conditions as AutomationCondition[] | undefined;
        if (conditions?.length && conditions.every((c) => evaluateCondition(c, context.snapshot))) {
          return { exit: true, reason: rule.exitReason };
        }
        break;
      }
    }
  }

  return { exit: false };
}
