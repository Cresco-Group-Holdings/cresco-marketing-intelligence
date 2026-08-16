export type MarketingDatePreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "this_month"
  | "previous_month"
  | "custom";

export type MarketingComparison = "previous_period" | "previous_month" | "none";

export type MarketingDateRange = {
  from: Date;
  to: Date;
  preset?: MarketingDatePreset;
  comparison?: MarketingComparison;
};

export type ResolvedMarketingDateRange = MarketingDateRange & {
  comparisonFrom: Date;
  comparisonTo: Date;
  label: string;
  comparisonLabel: string;
};

const PRESET_LABELS: Record<Exclude<MarketingDatePreset, "custom">, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  this_month: "This month",
  previous_month: "Previous month",
};

export function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function endOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

export function resolveMarketingDateRange(
  input: Partial<MarketingDateRange> & { now?: Date },
): ResolvedMarketingDateRange {
  const now = input.now ?? new Date();
  const preset = input.preset ?? "30d";
  const comparison = input.comparison ?? "previous_period";

  let from: Date;
  let to: Date;
  let label: string;

  if (preset === "custom" && input.from && input.to) {
    from = startOfDay(input.from);
    to = endOfDay(input.to);
    label = `${from.toLocaleDateString("en-GB")} – ${to.toLocaleDateString("en-GB")}`;
  } else {
    to = endOfDay(now);
    switch (preset) {
      case "today": {
        from = startOfDay(now);
        label = PRESET_LABELS.today;
        break;
      }
      case "yesterday": {
        const day = new Date(now);
        day.setDate(day.getDate() - 1);
        from = startOfDay(day);
        to = endOfDay(day);
        label = PRESET_LABELS.yesterday;
        break;
      }
      case "7d": {
        from = startOfDay(new Date(now.getTime() - 6 * 86_400_000));
        label = PRESET_LABELS["7d"];
        break;
      }
      case "90d": {
        from = startOfDay(new Date(now.getTime() - 89 * 86_400_000));
        label = PRESET_LABELS["90d"];
        break;
      }
      case "this_month": {
        from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
        label = PRESET_LABELS.this_month;
        break;
      }
      case "previous_month": {
        from = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
        label = PRESET_LABELS.previous_month;
        break;
      }
      case "30d":
      default: {
        from = startOfDay(new Date(now.getTime() - 29 * 86_400_000));
        label = PRESET_LABELS["30d"];
        break;
      }
    }
  }

  const durationMs = to.getTime() - from.getTime();
  let comparisonFrom: Date;
  let comparisonTo: Date;
  let comparisonLabel: string;

  if (comparison === "none") {
    comparisonFrom = from;
    comparisonTo = to;
    comparisonLabel = "";
  } else if (comparison === "previous_month") {
    comparisonTo = endOfDay(new Date(from.getFullYear(), from.getMonth(), 0));
    comparisonFrom = startOfDay(new Date(comparisonTo.getFullYear(), comparisonTo.getMonth(), 1));
    comparisonLabel = "vs previous month";
  } else {
    comparisonTo = new Date(from.getTime() - 1);
    comparisonFrom = new Date(comparisonTo.getTime() - durationMs);
    comparisonLabel = "vs previous period";
  }

  return {
    from,
    to,
    preset,
    comparison,
    comparisonFrom,
    comparisonTo,
    label,
    comparisonLabel,
  };
}

export function parseMarketingDateRangeSearchParams(
  params: URLSearchParams,
  now = new Date(),
): ResolvedMarketingDateRange {
  const presetParam = params.get("range") ?? params.get("preset");
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const comparisonParam = params.get("comparison");

  const preset = isMarketingDatePreset(presetParam) ? presetParam : "30d";
  const comparison: MarketingComparison =
    comparisonParam === "previous_month"
      ? "previous_month"
      : comparisonParam === "none"
        ? "none"
        : "previous_period";

  return resolveMarketingDateRange({
    preset,
    comparison,
    from: fromParam ? new Date(fromParam) : undefined,
    to: toParam ? new Date(toParam) : undefined,
    now,
  });
}

export function marketingDateRangeToSearchParams(range: MarketingDateRange): URLSearchParams {
  const params = new URLSearchParams();
  if (range.preset) {
    params.set("range", range.preset);
  }
  if (range.preset === "custom") {
    params.set("from", range.from.toISOString());
    params.set("to", range.to.toISOString());
  }
  if (range.comparison && range.comparison !== "previous_period") {
    params.set("comparison", range.comparison);
  }
  return params;
}

export function validateCustomDateRange(from: Date, to: Date, now = new Date()): string | null {
  if (from.getTime() > to.getTime()) {
    return "Start date must be before end date.";
  }
  if (to.getTime() > endOfDay(now).getTime()) {
    return "End date cannot be in the future.";
  }
  const maxRangeMs = 366 * 86_400_000;
  if (to.getTime() - from.getTime() > maxRangeMs) {
    return "Date range cannot exceed 366 days.";
  }
  return null;
}

export function isMarketingDatePreset(value: string | null): value is MarketingDatePreset {
  return (
    value === "today" ||
    value === "yesterday" ||
    value === "7d" ||
    value === "30d" ||
    value === "90d" ||
    value === "this_month" ||
    value === "previous_month" ||
    value === "custom"
  );
}

export function chartGranularityForRange(from: Date, to: Date): "hour" | "day" | "week" {
  const days = Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
  if (days <= 7) {
    return "day";
  }
  if (days <= 90) {
    return "day";
  }
  return "week";
}
