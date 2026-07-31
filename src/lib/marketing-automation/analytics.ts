import { METRIC_LIMITATIONS } from "./constants";

export type AutomationActionMetric = {
  actionType: string;
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
};

export type AutomationEnrollmentMetric = {
  enrolled: number;
  active: number;
  completed: number;
  exited: number;
  blocked: number;
};

export type AutomationAnalyticsInput = {
  enrollments: AutomationEnrollmentMetric;
  actions: AutomationActionMetric[];
  conversions?: number;
  revenue?: number;
  emailsSent?: number;
  emailsOpened?: number;
  emailsClicked?: number;
};

export type AutomationAnalytics = {
  enrollments: AutomationEnrollmentMetric;
  actions: AutomationActionMetric[];
  rates: {
    completionRate: number;
    exitRate: number;
    actionSuccessRate: number;
    conversionRate: number;
    emailOpenRate: number;
    emailClickRate: number;
  };
  limitations: Record<string, string>;
};

export function computeAutomationAnalytics(input: AutomationAnalyticsInput): AutomationAnalytics {
  const { enrollments, actions } = input;

  const totalTerminal = enrollments.completed + enrollments.exited;
  const completionRate = totalTerminal > 0 ? enrollments.completed / totalTerminal : 0;
  const exitRate = totalTerminal > 0 ? enrollments.exited / totalTerminal : 0;

  const actionAttempted = actions.reduce((sum, action) => sum + action.attempted, 0);
  const actionSucceeded = actions.reduce((sum, action) => sum + action.succeeded, 0);
  const actionSuccessRate = actionAttempted > 0 ? actionSucceeded / actionAttempted : 0;

  const conversionRate =
    enrollments.enrolled > 0 ? (input.conversions ?? 0) / enrollments.enrolled : 0;

  const emailOpenRate =
    (input.emailsSent ?? 0) > 0 ? (input.emailsOpened ?? 0) / (input.emailsSent as number) : 0;
  const emailClickRate =
    (input.emailsSent ?? 0) > 0 ? (input.emailsClicked ?? 0) / (input.emailsSent as number) : 0;

  const limitations: Record<string, string> = {
    conversions: METRIC_LIMITATIONS.conversions,
    revenue: METRIC_LIMITATIONS.revenue,
  };
  if ((input.emailsSent ?? 0) > 0) {
    limitations.emailEngagement = METRIC_LIMITATIONS.emailEngagement;
  }

  return {
    enrollments,
    actions,
    rates: {
      completionRate,
      exitRate,
      actionSuccessRate,
      conversionRate,
      emailOpenRate,
      emailClickRate,
    },
    limitations,
  };
}
