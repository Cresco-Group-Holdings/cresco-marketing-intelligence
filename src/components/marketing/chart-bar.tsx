"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export type ChartBarPoint = {
  label: string;
  value: number;
  formattedValue: string;
};

type ChartBarProps = {
  points: ChartBarPoint[];
  accentClassName?: string;
  ariaLabel: string;
  className?: string;
  maxVisibleLabels?: number;
};

export function ChartBarGroup({
  points,
  accentClassName = "bg-paid-accent/80",
  ariaLabel,
  className,
  maxVisibleLabels = 12,
}: ChartBarProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const tooltipId = useId();
  const visiblePoints =
    points.length > maxVisibleLabels ? points.slice(points.length - maxVisibleLabels) : points;
  const maxValue = Math.max(...visiblePoints.map((point) => point.value), 1);

  return (
    <div
      className={cn("flex h-48 items-end gap-1.5 overflow-x-auto sm:gap-2", className)}
      role="img"
      aria-label={ariaLabel}
    >
      {visiblePoints.map((point, index) => {
        const height = Math.max((point.value / maxValue) * 100, 4);
        const isActive = activeIndex === index;
        return (
          <div
            key={`${point.label}-${index}`}
            className="group relative flex min-w-[2rem] flex-1 flex-col items-center gap-2"
          >
            {isActive ? (
              <div
                id={tooltipId}
                role="tooltip"
                className="absolute bottom-full z-10 mb-2 w-max max-w-[12rem] rounded-lg border border-border bg-surface-elevated px-3 py-2 text-left shadow-md"
              >
                <p className="text-[11px] font-medium text-foreground-subtle">{point.label}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{point.formattedValue}</p>
              </div>
            ) : null}
            <div className="flex h-40 w-full items-end">
              <button
                type="button"
                className={cn(
                  "w-full rounded-t-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  accentClassName,
                  isActive && "opacity-100 ring-2 ring-ring",
                )}
                style={{ height: `${height}%` }}
                aria-label={`${point.label}: ${point.formattedValue}`}
                aria-describedby={isActive ? tooltipId : undefined}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
                onClick={() => setActiveIndex((current) => (current === index ? null : index))}
              />
            </div>
            <span className="max-w-full truncate text-[10px] text-foreground-subtle sm:text-xs">
              {point.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
