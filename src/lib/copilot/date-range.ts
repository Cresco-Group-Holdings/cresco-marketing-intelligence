export type CopilotDateRange = {
  from: Date;
  to: Date;
  comparisonFrom: Date;
  comparisonTo: Date;
  label: string;
  comparisonLabel: string;
};

export function resolveCopilotDateRange(input?: {
  preset?: string;
  from?: string;
  to?: string;
  comparison?: string;
}): CopilotDateRange {
  const now = new Date();
  const days = input?.preset === "7d" ? 7 : input?.preset === "90d" ? 90 : 30;
  const to = input?.to ? new Date(input.to) : now;
  const from = input?.from ? new Date(input.from) : new Date(to.getTime() - days * 86_400_000);
  const rangeMs = to.getTime() - from.getTime();
  const comparisonTo = new Date(from.getTime() - 86_400_000);
  const comparisonFrom = new Date(comparisonTo.getTime() - rangeMs);

  return {
    from,
    to,
    comparisonFrom,
    comparisonTo,
    label: `Last ${days} days`,
    comparisonLabel: "vs previous period",
  };
}
