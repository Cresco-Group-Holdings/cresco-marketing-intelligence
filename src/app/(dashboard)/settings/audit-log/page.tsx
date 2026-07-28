"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";

export default function AuditLogSettingsPage() {
  const { preference } = useWorkspace();
  const [events, setEvents] = useState<Array<{ id: string; action: string; resourceType: string; createdAt: string }>>([]);

  useEffect(() => {
    if (!preference.currentOrganisationId) return;
    void apiFetch<{ events: typeof events }>(
      `/api/audit-log?organisationId=${preference.currentOrganisationId}`,
      { organisationId: preference.currentOrganisationId },
    ).then((data) => setEvents(data.events)).catch(() => setEvents([]));
  }, [preference.currentOrganisationId]);

  return (
    <>
      <PageHeader title="Audit log" breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Audit log" }]} />
      <div className="space-y-3">
        {events.length === 0 ? <p className="text-sm text-slate-600">No audit events yet.</p> : null}
        {events.map((event) => (
          <Card key={event.id}>
            <CardHeader><CardTitle>{event.action}</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-600">
              <p>{event.resourceType}</p>
              <p>{new Date(event.createdAt).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
