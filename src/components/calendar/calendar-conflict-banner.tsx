"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { CalendarConflict } from "@/components/calendar/types";

type CalendarConflictBannerProps = {
  conflicts: CalendarConflict[];
  loading?: boolean;
  error?: string | null;
};

export function CalendarConflictBanner({ conflicts, loading, error }: CalendarConflictBannerProps) {
  if (loading) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-4 text-sm text-amber-900">Checking for scheduling conflicts…</CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-4 text-sm text-amber-900">
          Unable to load conflict warnings: {error}
        </CardContent>
      </Card>
    );
  }

  if (conflicts.length === 0) return null;

  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardContent className="flex items-start gap-3 py-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <div className="space-y-2">
          <p className="text-sm font-medium text-amber-900">
            {conflicts.length} scheduling conflict{conflicts.length === 1 ? "" : "s"} in this range
          </p>
          <ul className="space-y-1 text-sm text-amber-800">
            {conflicts.slice(0, 5).map((conflict) => (
              <li key={conflict.id}>
                {conflict.reason}
                {conflict.channel ? ` (${conflict.channel.replace(/_/g, " ").toLowerCase()})` : ""}
              </li>
            ))}
          </ul>
          {conflicts.length > 5 ? (
            <p className="text-xs text-amber-700">And {conflicts.length - 5} more…</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
