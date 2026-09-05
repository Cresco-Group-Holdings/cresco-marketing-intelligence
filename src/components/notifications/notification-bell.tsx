"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
  category: string;
};

export function NotificationBell() {
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);

  const load = useCallback(async () => {
    if (!organisationId) return;
    try {
      const data = await apiFetch<{
        unread: number;
        items: NotificationItem[];
      }>(`/api/notifications?organisationId=${organisationId}&limit=8&unreadOnly=false`, {
        organisationId,
        retry: false,
      });
      setUnread(data.unread);
      setItems(data.items);
    } catch {
      setUnread(0);
      setItems([]);
    }
  }, [organisationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(notificationId: string) {
    if (!organisationId) return;
    await apiFetch(
      `/api/notifications?organisationId=${organisationId}&notificationId=${notificationId}`,
      { method: "PATCH", organisationId },
    );
    await load();
  }

  if (!organisationId) return null;

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="relative"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
        <span className="sr-only">Notifications</span>
      </Button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-lg border border-border bg-surface-elevated shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <Link
              href="/notifications"
              className="text-xs text-foreground-muted underline"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
            <Link
              href="/settings/notifications"
              className="text-xs text-foreground-muted underline"
              onClick={() => setOpen(false)}
            >
              Preferences
            </Link>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-3 py-4 text-sm text-foreground-muted">You are all caught up.</li>
            ) : (
              items.map((item) => (
                <li key={item.id} className="border-b border-border-subtle px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-foreground-muted">{item.body}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {item.actionUrl ? (
                      <a
                        href={item.actionUrl}
                        className="text-xs font-medium text-foreground underline"
                        onClick={() => void markRead(item.id)}
                      >
                        Open
                      </a>
                    ) : null}
                    {!item.readAt ? (
                      <button
                        type="button"
                        className="text-xs text-foreground-subtle underline"
                        onClick={() => void markRead(item.id)}
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
