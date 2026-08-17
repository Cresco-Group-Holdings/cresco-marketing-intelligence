"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMarketingDateRange } from "@/components/marketing/marketing-date-range-provider";
import type { MarketingDatePreset } from "@/lib/marketing/date-range";
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

export function DateRangeSelector() {
  const { range, setPreset } = useMarketingDateRange();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

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
          className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border bg-surface-elevated p-2 shadow-lg"
        >
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
                setOpen(false);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
