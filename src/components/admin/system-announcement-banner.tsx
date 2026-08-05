"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";

type Announcement = {
  id: string;
  title: string;
  message: string;
  severity: string;
};

export function SystemAnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    void apiFetch<{ announcements: Announcement[] }>("/api/announcements/active")
      .then((data) => setAnnouncements(data.announcements))
      .catch(() => setAnnouncements([]));
  }, []);

  if (!announcements.length) return null;

  return (
    <div className="space-y-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
      {announcements.map((a) => (
        <div
          key={a.id}
          className={`rounded-md px-3 py-2 text-sm ${
            a.severity === "critical"
              ? "bg-red-50 text-red-900"
              : a.severity === "warning"
                ? "bg-amber-50 text-amber-900"
                : "bg-blue-50 text-blue-900"
          }`}
        >
          <strong>{a.title}</strong> — {a.message}
        </div>
      ))}
    </div>
  );
}
