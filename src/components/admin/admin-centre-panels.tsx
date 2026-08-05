"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

type HealthData = {
  readiness: { ready: boolean; checks: Array<{ name: string; status: string; message: string }> };
  metrics: Record<string, number | boolean>;
};

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/workspaces", label: "Workspaces" },
  { href: "/admin/security", label: "Security events" },
  { href: "/admin/failed-jobs", label: "Failed jobs" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/feature-flags", label: "Feature flags" },
  { href: "/admin/support-access", label: "Support access" },
  { href: "/admin/retention", label: "Data retention" },
];

export function AdminCentreLayout({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <>
      <PageHeader
        title={title}
        description="Platform administration — restricted to authorised operators."
        breadcrumbs={[{ label: "Admin Centre", href: "/admin" }, { label: title }]}
      />
      <nav className="mb-6 flex flex-wrap gap-2">
        {nav.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button size="sm" variant="outline">
              {item.label}
            </Button>
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}

export function AdminOverviewPanel() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<HealthData>("/api/admin/health");
      setHealth(data);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Access denied or unavailable.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6 text-sm text-amber-900">{error}</CardContent>
      </Card>
    );
  }

  if (!health) return <p className="text-sm text-slate-600">Loading system health…</p>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Readiness</CardTitle>
          <CardDescription>Production readiness checks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Badge variant={health.readiness.ready ? "default" : "warning"}>
            {health.readiness.ready ? "Ready" : "Degraded"}
          </Badge>
          <ul className="space-y-1 text-sm">
            {health.readiness.checks.map((check) => (
              <li key={check.name} className="flex justify-between gap-2">
                <span>{check.name}</span>
                <span className="text-slate-600">{check.status}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Platform metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {Object.entries(health.metrics).map(([key, value]) => (
              <li key={key} className="flex justify-between">
                <span>{key}</span>
                <span className="font-medium">{String(value)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
