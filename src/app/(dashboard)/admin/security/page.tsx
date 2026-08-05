"use client";

import { useEffect, useState } from "react";
import { AdminCentreLayout } from "@/components/admin/admin-centre-panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";

export default function AdminSecurityEventsPage() {
  const [events, setEvents] = useState<
    Array<{ id: string; action: string; resourceType: string; createdAt: string; actor?: { email: string } }>
  >([]);

  useEffect(() => {
    void apiFetch<{ events: typeof events }>("/api/admin/security-events").then((d) => setEvents(d.events));
  }, []);

  return (
    <AdminCentreLayout title="Security events">
      <div className="space-y-2">
        {events.map((event) => (
          <Card key={event.id}>
            <CardHeader>
              <CardTitle className="text-sm">{event.action}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-600">
              <p>{event.resourceType}</p>
              <p>{event.actor?.email ?? "System"}</p>
              <p>{new Date(event.createdAt).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminCentreLayout>
  );
}
