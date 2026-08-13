"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";

type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: string;
  actionUrl: string | null;
  dismissible: boolean;
};

export function AnnouncementBanner({ organisationId }: { organisationId: string | null }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const load = useCallback(async () => {
    if (!organisationId) return;
    const data = await apiFetch<{ announcements: Announcement[] }>(
      `/api/announcements?organisationId=${organisationId}`,
      { organisationId },
    );
    setAnnouncements(data.announcements);
  }, [organisationId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (announcements.length === 0) return null;

  const announcement = announcements[0]!;

  async function dismiss() {
    if (!organisationId) return;
    await apiFetch(`/api/announcements?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ action: "dismiss", announcementId: announcement.id }),
    });
    await load();
  }

  return (
    <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{announcement.title}</p>
          <p className="mt-1">{announcement.body}</p>
          {announcement.actionUrl ? (
            <a href={announcement.actionUrl} className="mt-2 inline-block underline">
              Learn more
            </a>
          ) : null}
        </div>
        {announcement.dismissible ? (
          <button type="button" className="text-xs underline" onClick={() => void dismiss()}>
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
