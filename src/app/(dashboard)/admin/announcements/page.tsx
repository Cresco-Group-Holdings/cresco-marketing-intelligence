"use client";

import { useEffect, useState } from "react";
import { AdminCentreLayout } from "@/components/admin/admin-centre-panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<
    Array<{ id: string; title: string; message: string; severity: string; isActive: boolean }>
  >([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const data = await apiFetch<{ announcements: typeof announcements }>("/api/admin/announcements");
    setAnnouncements(data.announcements);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    await apiFetch("/api/admin/announcements", {
      method: "POST",
      body: JSON.stringify({ title, message, severity: "info" }),
    });
    setTitle("");
    setMessage("");
    await load();
  }

  return (
    <AdminCentreLayout title="Announcements">
      <Card className="mb-4">
        <CardHeader><CardTitle>Create announcement</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="w-full rounded border px-3 py-2 text-sm" placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} />
          <Button size="sm" onClick={() => void create()}>Publish</Button>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {announcements.map((a) => (
          <Card key={a.id}>
            <CardContent className="pt-4 text-sm">
              <p className="font-medium">{a.title}</p>
              <p className="text-slate-600">{a.message}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminCentreLayout>
  );
}
