export type FormAnalytics = {
  views: number | null;
  starts: number | null;
  submissions: number;
  completionRate: number | null;
  validationFailures: number;
  abandonmentByStep: Record<string, number>;
  spamRate: number;
  qualifiedLeadRate: number | null;
  trackingDisclosure: string;
};

export function computeFormAnalytics(input: {
  views?: number | null;
  starts?: number | null;
  submissions: number;
  accepted: number;
  quarantined: number;
  validationFailures: number;
  qualifiedLeads?: number;
  stepStarts?: Record<string, number>;
}): FormAnalytics {
  const views = input.views ?? null;
  const starts = input.starts ?? null;
  const submissions = input.submissions;
  const completionRate = starts && starts > 0 ? Math.round((submissions / starts) * 100) : null;
  const spamRate = submissions > 0 ? Math.round((input.quarantined / submissions) * 100) : 0;
  const qualifiedLeadRate =
    input.qualifiedLeads !== undefined && submissions > 0
      ? Math.round((input.qualifiedLeads / submissions) * 100)
      : null;

  return {
    views,
    starts,
    submissions,
    completionRate,
    validationFailures: input.validationFailures,
    abandonmentByStep: input.stepStarts ?? {},
    spamRate,
    qualifiedLeadRate,
    trackingDisclosure:
      views === null || starts === null
        ? "View and start tracking not configured; completion rate may be incomplete."
        : "Analytics based on available first-party tracking.",
  };
}
