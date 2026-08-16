"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarketingDateRange } from "@/components/marketing/marketing-date-range-provider";
import type { MarketingComparison, MarketingDatePreset } from "@/lib/marketing/date-range";
import { startOfDay, validateCustomDateRange } from "@/lib/marketing/date-range";
import { cn } from "@/lib/utils";

const PRESETS: Array<{ value: MarketingDatePreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "previous_month", label: "Previous month" },
];

const COMPARISON_OPTIONS: Array<{ value: MarketingComparison; label: string }> = [
  { value: "previous_period", label: "Previous period" },
  { value: "previous_month", label: "Previous month" },
  { value: "none", label: "None" },
];

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function DateRangeSelector() {
  const { range, setPreset, setCustomRange, setComparison } = useMarketingDateRange();
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(range.preset === "custom");
  const [fromValue, setFromValue] = useState(toDateInputValue(range.from));
  const [toValue, setToValue] = useState(toDateInputValue(range.to));
  const [customError, setCustomError] = useState<string | null>(null);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFromValue(toDateInputValue(range.from));
    setToValue(toDateInputValue(range.to));
    setShowCustom(range.preset === "custom");
  }, [range.from, range.to, range.preset]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function applyCustomRange() {
    const from = startOfDay(new Date(fromValue));
    const to = startOfDay(new Date(toValue));
    to.setHours(23, 59, 59, 999);
    const error = validateCustomDateRange(from, to);
    if (error) {
      setCustomError(error);
      return;
    }
    setCustomError(null);
    setCustomRange(from, to);
    setOpen(false);
  }

  function resetCustom() {
    setFromValue(toDateInputValue(range.from));
    setToValue(toDateInputValue(range.to));
    setCustomError(null);
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <Calendar className="h-4 w-4" aria-hidden="true" />
        {range.label}
      </Button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Date range"
          className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-surface-elevated p-3 shadow-lg"
        >
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
            Presets
          </p>
          <div className="mt-1 space-y-0.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                role="menuitemradio"
                aria-checked={range.preset === preset.value}
                className={cn(
                  "flex w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  range.preset === preset.value
                    ? "bg-surface-hover text-foreground"
                    : "text-foreground-muted hover:bg-surface-hover hover:text-foreground",
                )}
                onClick={() => {
                  setPreset(preset.value);
                  setShowCustom(false);
                  setOpen(false);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-3 border-t border-border pt-3">
            <button
              type="button"
              className={cn(
                "flex w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                showCustom
                  ? "bg-surface-hover text-foreground"
                  : "text-foreground-muted hover:bg-surface-hover hover:text-foreground",
              )}
              onClick={() => setShowCustom((value) => !value)}
            >
              Custom range
            </button>

            {showCustom ? (
              <div className="mt-2 space-y-2 rounded-lg border border-border bg-surface p-3">
                <div>
                  <label htmlFor="date-from" className="text-xs text-foreground-subtle">
                    From
                  </label>
                  <Input
                    id="date-from"
                    type="date"
                    value={fromValue}
                    onChange={(event) => setFromValue(event.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label htmlFor="date-to" className="text-xs text-foreground-subtle">
                    To
                  </label>
                  <Input
                    id="date-to"
                    type="date"
                    value={toValue}
                    onChange={(event) => setToValue(event.target.value)}
                    className="mt-1"
                  />
                </div>
                {customError ? (
                  <p className="text-xs text-danger" role="alert">
                    {customError}
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="paid" onClick={applyCustomRange}>
                    Apply
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={resetCustom}>
                    Reset
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-3 border-t border-border pt-3">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
              Compare to
            </p>
            <div className="mt-1 space-y-0.5">
              {COMPARISON_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={range.comparison === option.value}
                  className={cn(
                    "flex w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    range.comparison === option.value
                      ? "bg-surface-hover text-foreground"
                      : "text-foreground-muted hover:bg-surface-hover hover:text-foreground",
                  )}
                  onClick={() => setComparison(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
