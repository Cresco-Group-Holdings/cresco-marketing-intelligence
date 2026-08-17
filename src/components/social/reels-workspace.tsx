"use client";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import type { OrganicSocialWorkspaceData, ReelItem } from "@/lib/organic-social/types";

function ReelList({ title, items }: { title: string; items: ReelItem[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-foreground-muted">No items in this section.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-foreground-subtle">
                  {item.channels.join(", ") || "No channels assigned"}
                  {item.duration ? ` · ${item.duration}` : ""}
                </p>
              </div>
              <Badge variant="muted">{item.publishingStatus}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ReelsWorkspace({
  reels,
}: {
  reels: OrganicSocialWorkspaceData["reels"];
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Reels & Shorts</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Manage short-form video across Instagram Reels, TikTok, and YouTube Shorts.
          </p>
        </div>
        <ButtonLink href="/content/studio/new?format=short_video" variant="organic" size="sm">
          Create Reel
        </ButtonLink>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ReelList title="Drafts" items={reels.drafts} />
        <ReelList title="Ready to publish" items={reels.ready} />
        <ReelList title="Scheduled" items={reels.scheduled} />
        <ReelList title="Published" items={reels.published} />
      </div>
    </div>
  );
}
