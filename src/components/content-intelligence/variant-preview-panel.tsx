"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MasterContent } from "@/lib/content-intelligence/types";

const CHANNELS = [
  { id: "LINKEDIN", label: "LinkedIn" },
  { id: "X", label: "X" },
  { id: "INSTAGRAM", label: "Instagram" },
  { id: "TIKTOK", label: "TikTok" },
  { id: "YOUTUBE", label: "YouTube" },
] as const;

function adaptForChannel(master: MasterContent, channel: string): string {
  const body = master.body || master.title;
  switch (channel) {
    case "X":
      return body.slice(0, 280);
    case "INSTAGRAM":
      return `${master.hook ?? master.title}\n\n${body.slice(0, 1200)}`;
    case "TIKTOK":
      return `Hook: ${master.hook ?? body.slice(0, 80)}\n\nScript: ${body.slice(0, 400)}`;
    case "YOUTUBE":
      return `Title: ${master.title}\n\n${body.slice(0, 600)}`;
    default:
      return `${master.hook ? `${master.hook}\n\n` : ""}${body}`;
  }
}

export function VariantPreviewPanel({ master }: { master: MasterContent }) {
  const [channel, setChannel] = useState<string>("LINKEDIN");
  const preview = adaptForChannel(master, channel);
  const hasContent = Boolean(master.body?.trim() || master.title?.trim());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Channel variants</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {CHANNELS.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => setChannel(ch.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                channel === ch.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-hover text-foreground-muted hover:text-foreground",
              )}
            >
              {ch.label}
            </button>
          ))}
        </div>
        {hasContent ? (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 text-sm">
            {preview}
          </pre>
        ) : (
          <p className="text-sm text-foreground-muted">
            Generate master content to preview channel-native adaptations.
          </p>
        )}
        <p className="text-[11px] text-foreground-subtle">
          One source → multiple channel-native versions. Technical lineage remains internal.
        </p>
      </CardContent>
    </Card>
  );
}
