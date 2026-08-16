"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  isMarketingDatePreset,
  marketingDateRangeToSearchParams,
  parseMarketingDateRangeSearchParams,
  resolveMarketingDateRange,
  type MarketingComparison,
  type MarketingDatePreset,
  type ResolvedMarketingDateRange,
} from "@/lib/marketing/date-range";

type MarketingDateRangeContextValue = {
  range: ResolvedMarketingDateRange;
  setPreset: (preset: MarketingDatePreset) => void;
  setCustomRange: (from: Date, to: Date) => void;
  setComparison: (comparison: MarketingComparison) => void;
};

const MarketingDateRangeContext = createContext<MarketingDateRangeContextValue | null>(null);

export function MarketingDateRangeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [range, setRange] = useState<ResolvedMarketingDateRange>(() =>
    parseMarketingDateRangeSearchParams(new URLSearchParams(searchParams.toString())),
  );

  useEffect(() => {
    setRange(parseMarketingDateRangeSearchParams(new URLSearchParams(searchParams.toString())));
  }, [searchParams]);

  const updateRange = useCallback(
    (next: ResolvedMarketingDateRange) => {
      setRange(next);
      const params = marketingDateRangeToSearchParams(next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const setPreset = useCallback(
    (preset: MarketingDatePreset) => {
      updateRange(
        resolveMarketingDateRange({
          preset,
          comparison: range.comparison,
        }),
      );
    },
    [range.comparison, updateRange],
  );

  const setCustomRange = useCallback(
    (from: Date, to: Date) => {
      updateRange(
        resolveMarketingDateRange({
          preset: "custom",
          from,
          to,
          comparison: range.comparison,
        }),
      );
    },
    [range.comparison, updateRange],
  );

  const setComparison = useCallback(
    (comparison: MarketingComparison) => {
      updateRange(
        resolveMarketingDateRange({
          preset: range.preset,
          from: range.from,
          to: range.to,
          comparison,
        }),
      );
    },
    [range, updateRange],
  );

  const value = useMemo(
    () => ({
      range,
      setPreset,
      setCustomRange,
      setComparison,
    }),
    [range, setComparison, setCustomRange, setPreset],
  );

  return (
    <MarketingDateRangeContext.Provider value={value}>{children}</MarketingDateRangeContext.Provider>
  );
}

export function useMarketingDateRange() {
  const context = useContext(MarketingDateRangeContext);
  if (!context) {
    throw new Error("useMarketingDateRange must be used within MarketingDateRangeProvider");
  }
  return context;
}

export function useMarketingDateRangeLabel(): string {
  const { range } = useMarketingDateRange();
  return range.label;
}

export { isMarketingDatePreset };
