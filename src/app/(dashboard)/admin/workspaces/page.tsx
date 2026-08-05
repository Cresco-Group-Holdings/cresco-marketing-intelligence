"use client";

import { useEffect, useState } from "react";
import { AdminCentreLayout } from "@/components/admin/admin-centre-panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";

export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<
    Array<{ id: string; name: string; slug: string; _count: { memberships: number; providerConnections: number } }>
  >([]);

  useEffect(() => {
    void apiFetch<{ workspaces: typeof workspaces }>("/api/admin/workspaces").then((d) =>
      setWorkspaces(d.workspaces),
    );
  }, []);

  return (
    <AdminCentreLayout title="Workspaces">
      <div className="space-y-3">
        {workspaces.map((ws) => (
          <Card key={ws.id}>
            <CardHeader>
              <CardTitle className="text-base">{ws.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              <p>Slug: {ws.slug}</p>
              <p>Members: {ws._count.memberships}</p>
              <p>Connections: {ws._count.providerConnections}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminCentreLayout>
  );
}
