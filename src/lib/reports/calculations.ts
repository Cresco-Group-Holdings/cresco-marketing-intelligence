type ContentPerformanceRow = {
  key: string;
  label: string;
  postsMeasured: number;
  totals: Record<string, number>;
  derived: Record<string, number | null>;
};

export function rankContentPerformance(
  groups: ContentPerformanceRow[],
  metricKey: string,
  limit = 5,
) {
  const ranked = [...groups]
    .filter((group) => group.postsMeasured > 0)
    .map((group) => ({
      ...group,
      score: group.totals[metricKey] ?? group.derived.engagementRate ?? 0,
    }))
    .sort((a, b) => Number(b.score) - Number(a.score));

  return {
    top: ranked.slice(0, limit),
    weak: [...ranked].reverse().slice(0, limit),
  };
}

export function collectDataLimitations(input: {
  postsMeasured: number;
  accountsMeasured: number;
  unavailableMetrics?: string[];
  syncIncomplete?: boolean;
}) {
  const limitations: string[] = [];
  if (input.postsMeasured === 0) {
    limitations.push("No post-level metrics were available for the selected period.");
  }
  if (input.accountsMeasured === 0) {
    limitations.push("No account-level metrics were available for the selected period.");
  }
  for (const metric of input.unavailableMetrics ?? []) {
    limitations.push(`${metric} was unavailable from connected providers for this period.`);
  }
  if (input.syncIncomplete) {
    limitations.push(
      "Analytics sync had not completed for all selected accounts before this report was generated.",
    );
  }
  return limitations;
}

export function resolveReportPeriod(
  reportType: string,
  timezone: string,
  reference = new Date(),
): { from: Date; to: Date } {
  const to = new Date(reference);
  const from = new Date(reference);
  if (reportType === "WEEKLY_PERFORMANCE") {
    from.setDate(from.getDate() - 7);
  } else if (reportType === "MONTHLY_PERFORMANCE") {
    from.setMonth(from.getMonth() - 1);
  } else {
    from.setDate(from.getDate() - 30);
  }
  return { from, to };
}
