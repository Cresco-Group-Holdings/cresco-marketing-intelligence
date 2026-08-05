"use client";

import { useEffect, useState } from "react";
import { AdminCentreLayout } from "@/components/admin/admin-centre-panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";

export default function AdminFailedJobsPage() {
  const [data, setData] = useState<{
    operationalAlerts: Array<{ id: string; title: string; status: string; safeErrorMessage: string }>;
    billingEvents: Array<{ id: string; eventType: string; status: string }>;
  } | null>(null);

  useEffect(() => {
    void apiFetch<typeof data>("/api/admin/failed-jobs").then(setData);
  }, []);

  return (
    <AdminCentreLayout title="Failed jobs">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Operational alerts</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data?.operationalAlerts.map((a) => (
              <div key={a.id} className="rounded border p-2">
                <p className="font-medium">{a.title}</p>
                <p className="text-slate-600">{a.status}</p>
                <p className="text-xs">{a.safeErrorMessage}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Billing events</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data?.billingEvents.map((e) => (
              <div key={e.id} className="rounded border p-2">
                <p className="font-medium">{e.eventType}</p>
                <p className="text-slate-600">{e.status}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminCentreLayout>
  );
}
