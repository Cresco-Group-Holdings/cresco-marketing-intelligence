import type { ExecutiveComparisonType } from "@prisma/client";
import type { ExecutiveDateRange } from "@/lib/executive/types";

export function computeDateRanges(
  from: Date,
  to: Date,
  comparisonType: ExecutiveComparisonType,
  customComparison?: { from?: Date | null; to?: Date | null },
): ExecutiveDateRange {
  const durationMs = to.getTime() - from.getTime();

  switch (comparisonType) {
    case "PREVIOUS_MONTH": {
      const comparisonTo = new Date(from);
      comparisonTo.setDate(0);
      const comparisonFrom = new Date(comparisonTo);
      comparisonFrom.setMonth(comparisonFrom.getMonth());
      comparisonFrom.setDate(1);
      return { from, to, comparisonFrom, comparisonTo };
    }
    case "PREVIOUS_QUARTER": {
      const quarterStart = new Date(from);
      quarterStart.setMonth(quarterStart.getMonth() - 3);
      const quarterEnd = new Date(from);
      quarterEnd.setMilliseconds(-1);
      return { from, to, comparisonFrom: quarterStart, comparisonTo: quarterEnd };
    }
    case "CUSTOM": {
      if (customComparison?.from && customComparison?.to) {
        return {
          from,
          to,
          comparisonFrom: customComparison.from,
          comparisonTo: customComparison.to,
        };
      }
      return computeDateRanges(from, to, "PREVIOUS_PERIOD");
    }
    case "PROJECT":
    case "BRAND":
    case "PREVIOUS_PERIOD":
    default: {
      const comparisonTo = new Date(from.getTime() - 1);
      const comparisonFrom = new Date(comparisonTo.getTime() - durationMs);
      return { from, to, comparisonFrom, comparisonTo };
    }
  }
}
