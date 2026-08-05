"use client";

import { useEffect, useState } from "react";
import { AdminCentreLayout } from "@/components/admin/admin-centre-panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

export default function AdminRetentionPage() {
  const [policies, setPolicies] = useState<
    Array<{ id: string; resourceType: string; retentionDays: number; description: string | null }>
  >([]);

  async function load() {
    const data = await apiFetch<{ policies: typeof policies }>("/api/admin/retention");
    setPolicies(data.policies);
  }

  useEffect(() => {
    void load();
  }, []);

  async function runAction(action: string) {
    await apiFetch(`/api/admin/retention?action=${action}`, { method: "POST" });
    await load();
  }

  return (
    <AdminCentreLayout title="Data retention">
      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void runAction("purge-audit")}>Purge expired audit logs</Button>
        <Button size="sm" variant="outline" onClick={() => void runAction("purge-security-audit")}>Purge security audit logs</Button>
        <Button size="sm" variant="outline" onClick={() => void runAction("recover-stale-locks")}>Recover stale locks</Button>
      </div>
      <div className="space-y-2">
        {policies.map((p) => (
          <Card key={p.id}>
            <CardHeader><CardTitle className="text-base">{p.resourceType}</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-600">
              <p>{p.retentionDays} days</p>
              <p>{p.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminCentreLayout>
  );
}
