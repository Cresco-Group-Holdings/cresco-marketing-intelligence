"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";
import { REVENUE_DISCLAIMER } from "@/lib/revenue/constants";

export type RevenueMode = "overview" | "customers" | "subscriptions" | "cohorts" | "unit-economics";

const nav: Array<{ label: string; href: string; mode: RevenueMode }> = [
  { label: "Overview", href: "/analytics/revenue", mode: "overview" },
  { label: "Customers", href: "/analytics/revenue/customers", mode: "customers" },
  { label: "Subscriptions", href: "/analytics/revenue/subscriptions", mode: "subscriptions" },
  { label: "Cohorts", href: "/analytics/revenue/cohorts", mode: "cohorts" },
  { label: "Unit economics", href: "/analytics/revenue/unit-economics", mode: "unit-economics" },
];

export function RevenueAnalyticsView({ mode }: { mode: RevenueMode }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const [days, setDays] = useState("28");
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const query = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - Number(days) * 86_400_000);
    return new URLSearchParams({
      organisationId: organisationId ?? "",
      section: mode === "overview" ? "overview" : mode,
      from: from.toISOString(),
      to: to.toISOString(),
    }).toString();
  }, [organisationId, days, mode]);

  const load = useCallback(async () => {
    if (!brandId || !organisationId) return;
    try {
      setData(await apiFetch(`/api/brands/${brandId}/revenue/analytics?${query}`, { organisationId }));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load revenue analytics.");
    }
  }, [brandId, organisationId, query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncStripe() {
    if (!brandId || !organisationId) return;
    setSyncing(true);
    try {
      await apiFetch(`/api/brands/${brandId}/revenue/sync?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({ sourceType: "STRIPE" }),
      });
      await load();
    } catch {
      setError("Stripe sync failed or is not configured.");
    } finally {
      setSyncing(false);
    }
  }

  const overview =
    mode === "overview" && data && typeof data === "object" && "overview" in data
      ? (data as { overview: Record<string, unknown> }).overview
      : null;
  const metrics = overview?.metrics as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue intelligence"
        description="Connect marketing activity with customer and revenue outcomes using documented formulas."
        breadcrumbs={[{ label: "Analytics", href: "/analytics/revenue" }, { label: mode }]}
      />
      <nav className="flex flex-wrap gap-2">
        {nav.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button variant={item.mode === mode ? "primary" : "outline"} size="sm">{item.label}</Button>
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <select className="rounded-md border px-3 py-2 text-sm" value={days} onChange={(e) => setDays(e.target.value)}>
          {["7", "14", "28", "90"].map((v) => (
            <option key={v} value={v}>Last {v} days</option>
          ))}
        </select>
        <Button size="sm" disabled={syncing} onClick={() => void syncStripe()}>
          {syncing ? "Syncing…" : "Sync Stripe"}
        </Button>
      </div>
      <p className="rounded border border-border bg-surface-subtle p-3 text-sm text-foreground-muted">{REVENUE_DISCLAIMER}</p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {mode === "overview" && overview && metrics && (
        <>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>Reporting: {String(overview.reportingCurrency)}</span>
            <span>Freshness: {String(overview.dataFreshness ?? "—")}</span>
            <span>Unattributed: {Number(metrics.unattributedRevenue ?? 0).toLocaleString()}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total revenue", metrics.totalRevenue],
              ["Net revenue", metrics.netRevenue],
              ["MRR", metrics.mrr],
              ["ARR", metrics.arr],
            ].map(([label, value]) => (
              <Card key={String(label)}>
                <CardHeader><CardTitle className="text-base">{String(label)}</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{Number(value ?? 0).toLocaleString()}</CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle>Formula definitions</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {Object.entries((overview.formulaDefinitions as Record<string, string>) ?? {}).map(([key, def]) => (
                <p key={key}><strong>{key}:</strong> {def}</p>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {mode === "customers" && data && typeof data === "object" && "customers" in data ? (
        <Card>
          <CardHeader><CardTitle>Revenue customers</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Customer</th>
                  <th>Source</th>
                  <th>Identity</th>
                  <th>Subscriptions</th>
                </tr>
              </thead>
              <tbody>
                {((data as { customers: Array<Record<string, unknown>> }).customers ?? []).map((c) => (
                  <tr key={String(c.id)} className="border-b">
                    <td className="py-2">{String(c.displayName ?? c.providerCustomerId)}</td>
                    <td>{String(c.sourceType)}</td>
                    <td>{c.identityLinked ? <Badge>Linked</Badge> : <Badge variant="muted">Unlinked</Badge>}</td>
                    <td>{Number(c.activeSubscriptions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {mode === "subscriptions" && data && typeof data === "object" && "subscriptions" in data ? (
        <Card>
          <CardHeader><CardTitle>Subscriptions</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Plan</th>
                  <th>Status</th>
                  <th>MRR</th>
                  <th>Currency</th>
                </tr>
              </thead>
              <tbody>
                {((data as { subscriptions: Array<Record<string, unknown>> }).subscriptions ?? []).map((s) => (
                  <tr key={String(s.id)} className="border-b">
                    <td className="py-2">{String(s.planName ?? s.productName ?? "—")}</td>
                    <td>{String(s.status)}</td>
                    <td>{Number(s.mrrAmount ?? 0).toLocaleString()}</td>
                    <td>{String(s.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {mode === "cohorts" && data && typeof data === "object" && "cohorts" in data ? (
        <Card>
          <CardHeader><CardTitle>Revenue cohorts</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Cohort</th>
                  <th>Customers</th>
                  <th>Revenue</th>
                  <th>MRR</th>
                </tr>
              </thead>
              <tbody>
                {((data as { cohorts: Array<Record<string, unknown>> }).cohorts ?? []).map((c) => (
                  <tr key={String(c.cohortKey)} className="border-b">
                    <td className="py-2">{String(c.cohortKey)}</td>
                    <td>{Number(c.customerCount)}</td>
                    <td>{Number(c.totalRevenue).toLocaleString()}</td>
                    <td>{Number(c.mrr).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {mode === "unit-economics" && data && typeof data === "object" && "unitEconomics" in data ? (
        <Card>
          <CardHeader><CardTitle>Unit economics</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
            {Object.entries((data as { unitEconomics: Record<string, unknown> }).unitEconomics)
              .filter(([key]) => ["cac", "blendedCac", "paidCac", "ltv", "ltvCacRatio", "paybackMonths", "revenuePerLead", "revenuePerConversion", "trialToPaidRate", "arpc"].includes(key))
              .map(([key, value]) => (
                <div key={key} className="rounded border p-3">
                  <p className="font-medium">{key}</p>
                  <p className="text-lg">{value == null ? "—" : String(value)}</p>
                </div>
              ))}
            <p className="col-span-2 text-muted-foreground">
              {String((data as { unitEconomics: Record<string, unknown> }).unitEconomics.ltvExtensionPoint ?? "")}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
