"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";
import { EXECUTIVE_DISCLAIMER, EXECUTIVE_SECTIONS } from "@/lib/executive/constants";
import type { MetricComparison } from "@/lib/executive/types";
import { formatMetricDisplay } from "@/lib/executive/metric-value";

export type ExecutiveMode =
  | "overview"
  | "acquisition"
  | "social"
  | "search"
  | "advertising"
  | "funnel"
  | "attribution"
  | "leads"
  | "revenue"
  | "data-health";

const KPI_LABELS: Record<string, string> = {
  visitors: "Visitors",
  leads: "Leads",
  qualifiedLeads: "Qualified leads",
  signups: "Signups",
  trials: "Trials",
  customers: "Customers",
  conversionRate: "Conversion rate",
  marketingSpend: "Marketing spend",
  revenue: "Revenue",
  mrr: "MRR",
  cac: "CAC",
  ltv: "LTV",
  attributedRevenue: "Attributed revenue",
  organicTraffic: "Organic traffic",
  paidTraffic: "Paid traffic",
  socialEngagement: "Social engagement",
};

function KpiCard({ label, metric }: { label: string; metric: MetricComparison }) {
  const [showHow, setShowHow] = useState(false);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground-muted">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">
          {metric.available ? formatMetricDisplay(metric) : (
            <span className="text-base text-foreground-muted">Unavailable</span>
          )}
        </p>
        {metric.available && metric.changePercent != null ? (
          <p className={`text-sm ${metric.changePercent >= 0 ? "text-success" : "text-danger"}`}>
            {metric.changeAbsolute != null && metric.changeAbsolute >= 0 ? "+" : ""}
            {metric.changePercent}% vs previous
          </p>
        ) : null}
        {!metric.available && metric.unavailableReason ? (
          <p className="text-xs text-foreground-muted">{metric.unavailableReason}</p>
        ) : null}
        {metric.formula ? (
          <button
            type="button"
            className="mt-2 text-xs text-paid-accent underline"
            onClick={() => setShowHow((v) => !v)}
          >
            How calculated
          </button>
        ) : null}
        {showHow && metric.formula ? (
          <p className="mt-1 text-xs text-foreground-muted">{metric.formula}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ExecutiveAnalyticsView({ mode }: { mode: ExecutiveMode }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const [days, setDays] = useState("28");
  const [comparisonType, setComparisonType] = useState("PREVIOUS_PERIOD");
  const [data, setData] = useState<unknown>(null);
  const [warnings, setWarnings] = useState<Array<{ level: string; message: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFormulas, setShowFormulas] = useState(false);

  const section = mode === "overview" ? "overview" : mode;

  const query = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - Number(days) * 86_400_000);
    return new URLSearchParams({
      organisationId: organisationId ?? "",
      section,
      from: from.toISOString(),
      to: to.toISOString(),
      comparisonType,
    }).toString();
  }, [organisationId, days, section, comparisonType]);

  const load = useCallback(async () => {
    if (!brandId || !organisationId) return;
    setLoading(true);
    try {
      const [sectionData, warningData] = await Promise.all([
        apiFetch(`/api/brands/${brandId}/executive/analytics?${query}`, { organisationId }),
        apiFetch(
          `/api/brands/${brandId}/executive/analytics?organisationId=${organisationId}&section=warnings&from=${encodeURIComponent(new Date(Date.now() - Number(days) * 86_400_000).toISOString())}&to=${encodeURIComponent(new Date().toISOString())}`,
          { organisationId },
        ),
      ]);
      setData(sectionData);
      setWarnings(
        warningData && typeof warningData === "object" && "warnings" in warningData
          ? ((warningData as { warnings: { warnings: Array<{ level: string; message: string }> } }).warnings
              ?.warnings ?? [])
          : [],
      );
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load executive dashboard.");
    } finally {
      setLoading(false);
    }
  }, [brandId, organisationId, query, days]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!organisationId) return;
    void apiFetch(`/api/executive/preferences?organisationId=${organisationId}`, { organisationId })
      .then((prefs) => {
        if (prefs && typeof prefs === "object" && "preferences" in prefs) {
          const p = (prefs as { preferences: { dateRangeDays?: number; comparisonType?: string } | null }).preferences;
          if (p?.dateRangeDays) setDays(String(p.dateRangeDays));
          if (p?.comparisonType) setComparisonType(p.comparisonType);
        }
      })
      .catch(() => undefined);
  }, [organisationId]);

  async function savePreferences() {
    if (!organisationId || !brandId) return;
    await apiFetch(`/api/executive/preferences?organisationId=${organisationId}`, {
      method: "PATCH",
      organisationId,
      body: JSON.stringify({
        brandId,
        dateRangeDays: Number(days),
        comparisonType,
      }),
    });
  }

  async function exportReport(format: "csv" | "pdf") {
    if (!brandId || !organisationId) return;
    const to = new Date();
    const from = new Date(to.getTime() - Number(days) * 86_400_000);
    const params = new URLSearchParams({
      organisationId,
      format,
      comparisonType,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    window.open(`/api/brands/${brandId}/executive/export?${params.toString()}`, "_blank");
  }

  const overview =
    mode === "overview" && data && typeof data === "object" && "overview" in data
      ? (data as { overview: Record<string, unknown> }).overview
      : null;
  const kpis = (overview?.kpis ?? {}) as Record<string, MetricComparison>;
  const sectionResult =
    mode !== "overview" && data && typeof data === "object" && "section" in data
      ? (data as { section: { data: unknown; error: string | null; confidence: Record<string, unknown> | null } }).section
      : null;

  const currentSection = EXECUTIVE_SECTIONS.find((s) => s.key === mode || (mode === "overview" && s.key === "overview"));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive intelligence"
        description="Trusted growth, acquisition, conversion and revenue view from synchronised marketing data."
        breadcrumbs={[
          { label: "Analytics", href: "/analytics/executive" },
          { label: currentSection?.label ?? mode },
        ]}
      />

      <nav className="flex flex-wrap gap-2">
        {EXECUTIVE_SECTIONS.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button
              variant={
                (item.key === "overview" && mode === "overview") || item.key === mode
                  ? "primary"
                  : "outline"
              }
              size="sm"
            >
              {item.label}
            </Button>
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        >
          {["7", "14", "28", "90"].map((v) => (
            <option key={v} value={v}>Last {v} days</option>
          ))}
        </select>
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={comparisonType}
          onChange={(e) => setComparisonType(e.target.value)}
        >
          <option value="PREVIOUS_PERIOD">Previous period</option>
          <option value="PREVIOUS_MONTH">Previous month</option>
          <option value="PREVIOUS_QUARTER">Previous quarter</option>
        </select>
        <Button size="sm" variant="outline" onClick={() => void savePreferences()}>
          Save preferences
        </Button>
        <Button size="sm" variant="outline" onClick={() => void exportReport("csv")}>
          Export CSV
        </Button>
        <Button size="sm" variant="outline" onClick={() => void exportReport("pdf")}>
          PDF snapshot
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowFormulas((v) => !v)}>
          {showFormulas ? "Hide" : "Show"} formulas
        </Button>
      </div>

      <p className="rounded border border-border bg-surface-subtle p-3 text-sm text-foreground-muted">{EXECUTIVE_DISCLAIMER}</p>

      {warnings.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Operational warnings</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {warnings.map((warning, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <Badge variant={warning.level === "critical" ? "warning" : "muted"}>{warning.level}</Badge>
                <span>{warning.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

      {mode === "overview" && overview ? (
        <>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>Reporting: {String(overview.reportingCurrency)}</span>
            <span>
              Period: {String((overview.period as { from: string }).from).slice(0, 10)} –{" "}
              {String((overview.period as { to: string }).to).slice(0, 10)}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(KPI_LABELS).map(([key, label]) => {
              const metric = kpis[key];
              if (!metric) return null;
              return <KpiCard key={key} label={label} metric={metric} />;
            })}
          </div>
          {showFormulas && overview.formulaDefinitions ? (
            <Card>
              <CardHeader><CardTitle>Formula definitions</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {Object.entries(overview.formulaDefinitions as Record<string, string>).map(([key, def]) => (
                  <p key={key}><strong>{key}:</strong> {def}</p>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      {mode !== "overview" && sectionResult ? (
        <Card>
          <CardHeader>
            <CardTitle>{currentSection?.label}</CardTitle>
          </CardHeader>
          <CardContent>
            {sectionResult.error ? (
              <p className="text-sm text-amber-700">{sectionResult.error}</p>
            ) : (
              <pre className="max-h-96 overflow-auto rounded bg-surface-subtle p-4 text-xs">
                {JSON.stringify(sectionResult.data, null, 2)}
              </pre>
            )}
            {sectionResult.confidence ? (
              <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                <p>Source: {String(sectionResult.confidence.source)}</p>
                {sectionResult.confidence.lastUpdated ? (
                  <p>Last updated: {String(sectionResult.confidence.lastUpdated)}</p>
                ) : null}
                {sectionResult.confidence.formula ? (
                  <p>Formula: {String(sectionResult.confidence.formula)}</p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
