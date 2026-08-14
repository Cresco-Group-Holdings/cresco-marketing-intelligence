"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api/client";
import { INBOX_SECTIONS, SECTION_LABELS, type InboxSectionKey } from "@/lib/collaboration/inbox-sections";
import { AnnouncementBanner } from "@/components/collaboration/announcement-banner";
import { CommentThreadPanel } from "@/components/collaboration/comment-thread-panel";

type InboxItemView = {
  id: string;
  section: string;
  category: string;
  title: string;
  message: string;
  priority: string;
  actionUrl: string | null;
  status: string;
  createdAt: string;
};

export default function NotificationsPage() {
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;
  const [section, setSection] = useState<InboxSectionKey>("ALL");
  const [items, setItems] = useState<InboxItemView[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!organisationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ unread: number; items: InboxItemView[] }>(
        `/api/inbox?organisationId=${organisationId}&section=${section}`,
        { organisationId },
      );
      setUnread(data.unread);
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inbox.");
    } finally {
      setLoading(false);
    }
  }, [organisationId, section]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markAllRead() {
    if (!organisationId) return;
    await apiFetch(`/api/inbox?organisationId=${organisationId}`, {
      method: "PATCH",
      organisationId,
      body: JSON.stringify({ action: "markAllRead" }),
    });
    await load();
  }

  async function bulkAction(action: "read" | "dismiss" | "archive") {
    if (!organisationId || selected.size === 0) return;
    await apiFetch(`/api/inbox?organisationId=${organisationId}`, {
      method: "PATCH",
      organisationId,
      body: JSON.stringify({ action: "bulk", itemIds: [...selected], bulkAction: action }),
    });
    setSelected(new Set());
    await load();
  }

  function statusVariant(status: string): "default" | "muted" | "warning" {
    if (status === "UNREAD") return "warning";
    if (status === "READ") return "default";
    return "muted";
  }

  return (
    <>
      <PageHeader
        title="Notifications & Inbox"
        description="Unified collaboration inbox across approvals, publishing, integrations, CRM, and AI."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Notifications" }]}
      />

      <AnnouncementBanner organisationId={organisationId} />

      <div className="mb-4 flex flex-wrap gap-2">
        {INBOX_SECTIONS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              section === key ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {SECTION_LABELS[key]}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Inbox {unread > 0 ? <span className="text-sm text-muted-foreground">({unread} unread)</span> : null}
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void markAllRead()}>
                Mark all read
              </Button>
              {selected.size > 0 ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => void bulkAction("read")}>
                    Mark selected
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void bulkAction("archive")}>
                    Archive
                  </Button>
                </>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
            {!loading && items.length === 0 ? (
              <p className="text-sm text-muted-foreground">You are all caught up.</p>
            ) : null}
            {items.map((item) => (
              <div key={item.id} className="flex gap-3 rounded-md border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={(event) => {
                    const next = new Set(selected);
                    if (event.target.checked) next.add(item.id);
                    else next.delete(item.id);
                    setSelected(next);
                  }}
                />
                <div className="flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                    <span className="font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.category}</span>
                  </div>
                  <p className="text-muted-foreground">{item.message}</p>
                  {item.actionUrl ? (
                    <a href={item.actionUrl} className="mt-1 inline-block text-xs text-blue-600 underline">
                      Open
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Digest settings</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Configure daily and weekly digests in{" "}
              <a href="/settings/notifications" className="underline">
                notification preferences
              </a>
              .
            </CardContent>
          </Card>
          <CommentThreadPanel
            organisationId={organisationId}
            resourceType="demo"
            resourceId="collaboration-demo"
          />
        </div>
      </div>
    </>
  );
}
