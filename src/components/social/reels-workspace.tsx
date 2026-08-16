"use client";

import { useState } from "react";
import { Film } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OrganicSocialWorkspaceData, ReelItem } from "@/lib/organic-social/types";
import { cn } from "@/lib/utils";

const PIPELINE_TABS = [
  { id: "drafts", label: "Drafts" },
  { id: "ready", label: "Ready" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Published" },
] as const;

type PipelineTab = (typeof PIPELINE_TABS)[number]["id"];

function statusVariant(status: string): "draft" | "scheduled" | "published" | "failed" | "neutral" {
  const normalised = status.toLowerCase();
  if (normalised.includes("fail")) return "failed";
  if (normalised.includes("schedul")) return "scheduled";
  if (normalised.includes("publish")) return "published";
  if (normalised.includes("draft")) return "draft";
  return "neutral";
}

function ReelCard({ item }: { item: ReelItem }) {
  return (
    <article className="flex gap-3 rounded-xl border border-border bg-surface-elevated p-3 transition-colors hover:border-border-strong hover:bg-surface-hover">
      <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-foreground-subtle">
        <Film className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-medium text-foreground">{item.title}</h3>
          <StatusBadge variant={statusVariant(item.publishingStatus)}>
            {item.publishingStatus}
          </StatusBadge>
        </div>
        <p className="mt-1 text-xs text-foreground-subtle">
          {item.channels.join(" · ") || "No channels assigned"}
          {item.duration ? ` · ${item.duration}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-foreground-muted">
          {item.views != null ? <span>{item.views.toLocaleString()} views</span> : null}
          {item.engagement != null ? (
            <span>{item.engagement.toLocaleString()} engagements</span>
          ) : null}
          {item.scheduledAt ? <span>{item.scheduledAt}</span> : null}
          {item.fatigueDetected ? (
            <span className="text-warning">Fatigue detected</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ReelGrid({ items }: { items: ReelItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-subtle px-4 py-10 text-center text-sm text-foreground-muted">
        No items in this section.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <ReelCard key={item.id} item={item} />
      ))}
    </div>
  );
}

export function ReelsWorkspace({
  reels,
}: {
  reels: OrganicSocialWorkspaceData["reels"];
}) {
  const [tab, setTab] = useState<PipelineTab>("drafts");

  const tabItems: Record<PipelineTab, ReelItem[]> = {
    drafts: reels.drafts,
    ready: reels.ready,
    scheduled: reels.scheduled,
    published: reels.published,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title">Reels & Shorts</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Manage short-form video across Instagram Reels, TikTok, and YouTube Shorts.
          </p>
        </div>
        <ButtonLink href="/content/studio/new?format=short_video" variant="organic" size="sm">
          Create Reel
        </ButtonLink>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as PipelineTab)}>
        <TabsList>
          {PIPELINE_TABS.map((pipelineTab) => (
            <TabsTrigger key={pipelineTab.id} value={pipelineTab.id}>
              {pipelineTab.label}
              <Badge variant="muted" className={cn("ml-2 text-[10px]")}>
                {tabItems[pipelineTab.id].length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        {PIPELINE_TABS.map((pipelineTab) => (
          <TabsContent key={pipelineTab.id} value={pipelineTab.id}>
            <ReelGrid items={tabItems[pipelineTab.id]} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
