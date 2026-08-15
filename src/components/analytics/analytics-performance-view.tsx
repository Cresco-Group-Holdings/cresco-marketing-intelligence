"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/components/workspace/workspace-provider";

type DashboardContract = {
  contract: string;
  freshness?: {
    state: string;
    coverageState?: string;
    warnings?: string[];
    lastDataAt?: string | null;
  };
  baseMetrics?: Record<string, number>;
  derivedMetrics?: Record<string, number | null>;
  partialMetrics?: string[];
};

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function fetchContract(
  organisationId: string,
  path: string,
  range: { from: string; to: string },
): Promise<DashboardContract> {
  const params = new URLSearchParams({
    organisationId,
    from: range.from,
    to: range.to,
  });
  const response = await fetch(`/api/analytics/dashboard/${path}?${params.toString()}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Failed to load ${path}`);
  }
  const payload = await response.json();
  return payload.data;
}

export function AnalyticsPerformanceView() {
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;
  const range = useMemo(() => defaultRange(), []);

  const [overview, setOverview] = useState<DashboardContract | null>(null);
  const [freshness, setFreshness] = useState<DashboardContract | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organisationId) return;
    setLoading(true);
    setError(null);
    try {
      const [executive, freshnessContract] = await Promise.all([
        fetchContract(organisationId, "executive", range),
        fetchContract(organisationId, "freshness", range),
      ]);
      setOverview(executive);
      setFreshness(freshnessContract);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, [organisationId, range]);

  useEffect(() => {
    void load();
  }, [load]);

  const coverageState = overview?.freshness?.coverageState ?? freshness?.freshness?.coverageState;
  const warnings = [
    ...(overview?.freshness?.warnings ?? []),
    ...(freshness?.freshness?.warnings ?? []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance core"
        description="Provider-independent analytics from manually imported or internal facts."
      />

      {loading ? <p className="text-sm text-muted-foreground">Loading analytics contracts…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && !error ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Data state</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Coverage: {coverageState ?? "UNKNOWN"}</p>
              <p>Freshness: {overview?.freshness?.state ?? freshness?.freshness?.state ?? "UNKNOWN"}</p>
              <p>Last data: {overview?.freshness?.lastDataAt ?? "—"}</p>
              {warnings.length > 0 ? (
                <ul className="list-disc pl-5 text-muted-foreground">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Executive metrics</CardTitle>
            </CardHeader>
            <CardContent>
              {coverageState === "NO_DATA" ? (
                <p className="text-sm text-muted-foreground">
                  No analytics facts yet. Import metrics via the API to populate dashboards.
                </p>
              ) : (
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(overview?.baseMetrics ?? {}).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-muted-foreground">{key}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                  {Object.entries(overview?.derivedMetrics ?? {}).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-muted-foreground">{key}</dt>
                      <dd className="font-medium">{value ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
