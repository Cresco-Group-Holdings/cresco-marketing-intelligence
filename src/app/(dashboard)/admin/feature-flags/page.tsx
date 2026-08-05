"use client";

import { useEffect, useState } from "react";
import { AdminCentreLayout } from "@/components/admin/admin-centre-panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

export default function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<Array<{ id: string; key: string; displayName: string; enabled: boolean }>>([]);

  async function load() {
    const data = await apiFetch<{ flags: typeof flags }>("/api/admin/feature-flags");
    setFlags(data.flags);
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle(key: string, displayName: string, enabled: boolean) {
    await apiFetch("/api/admin/feature-flags", {
      method: "POST",
      body: JSON.stringify({ key, displayName, enabled: !enabled }),
    });
    await load();
  }

  return (
    <AdminCentreLayout title="Feature flags">
      <div className="space-y-2">
        {flags.map((flag) => (
          <Card key={flag.id}>
            <CardHeader>
              <CardTitle className="text-base">{flag.displayName}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{flag.key}</span>
              <Button size="sm" variant="outline" onClick={() => void toggle(flag.key, flag.displayName, flag.enabled)}>
                {flag.enabled ? "Disable" : "Enable"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminCentreLayout>
  );
}
