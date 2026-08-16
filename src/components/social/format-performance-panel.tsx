"use client";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import type { FormatPerformanceItem } from "@/lib/organic-social/types";

export function FormatPerformancePanel({ formats }: { formats: FormatPerformanceItem[] }) {
  if (formats.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-surface-elevated p-6 text-sm text-foreground-muted">
        <h2 className="font-semibold text-foreground">Format performance</h2>
        <p className="mt-2">Connect channels and publish content to compare format performance.</p>
      </section>
    );
  }

  const maxRate = Math.max(...formats.map((item) => item.engagementRate ?? 0), 0.01);

  return (
    <section
      aria-labelledby="format-performance-heading"
      className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5"
    >
      <h2 id="format-performance-heading" className="text-sm font-semibold text-foreground">
        Format performance
      </h2>
      <p className="mt-1 text-xs text-foreground-muted">
        Engagement by content format in the selected period.
      </p>
      <div className="mt-4 space-y-3">
        {formats.slice(0, 6).map((item) => (
          <article key={item.format}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">{item.format}</span>
              <Badge variant="muted">{item.contentCount} posts</Badge>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-organic-accent/80"
                style={{
                  width: `${((item.engagementRate ?? 0) / maxRate) * 100}%`,
                }}
              />
            </div>
            <p className="mt-1 text-xs text-foreground-subtle">
              Engagement rate{" "}
              {item.engagementRate != null ? `${item.engagementRate.toFixed(2)}%` : "—"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
