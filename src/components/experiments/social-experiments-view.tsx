"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";
import { EXPERIMENT_TEST_TYPE_LABELS } from "@/lib/experiments/constants";

type ExperimentItem = {
  id: string;
  title: string;
  status: string;
  testType: keyof typeof EXPERIMENT_TEST_TYPE_LABELS;
  targetProvider: string;
  startDate: string;
  endDate: string;
  validityWarnings: Array<{ code: string; message: string; severity: string }>;
  hypothesis?: { statement: string } | null;
  decision?: {
    outcome: string;
    limitations: string;
    percentageDifference: string | null;
  } | null;
  variants: Array<{ id: string; label: string }>;
};

export function SocialExperimentsView({ experimentId }: { experimentId?: string }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const [items, setItems] = useState<ExperimentItem[]>([]);
  const [selected, setSelected] = useState<ExperimentItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!brandId || !organisationId) return;
    const data = await apiFetch<{ items: ExperimentItem[] }>(
      `/api/brands/${brandId}/experiments?organisationId=${organisationId}`,
      { organisationId },
    );
    setItems(data.items);
    if (experimentId) {
      const detail = await apiFetch<{ experiment: ExperimentItem }>(
        `/api/brands/${brandId}/experiments/${experimentId}?organisationId=${organisationId}`,
        { organisationId },
      );
      setSelected(detail.experiment);
    }
  }, [brandId, organisationId, experimentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(id: string, action: "ready" | "compute-results") {
    if (!brandId || !organisationId) return;
    await apiFetch(
      `/api/brands/${brandId}/experiments/${id}/actions?action=${action}&organisationId=${organisationId}`,
      { method: "POST", organisationId },
    );
    setMessage(`${action} completed.`);
    await load();
  }

  async function reuseFinding(id: string, reuseType: string) {
    if (!brandId || !organisationId) return;
    if (!window.confirm("Apply this experiment finding? Brand knowledge updates require your confirmation.")) {
      return;
    }
    await apiFetch(`/api/brands/${brandId}/experiments/${id}/reuse?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ reuseType, confirmed: true }),
    });
    setMessage("Finding reused.");
    await load();
  }

  const active = selected ?? items[0] ?? null;

  return (
    <>
      <PageHeader
        title="Content experiments"
        description="Test content hypotheses with transparent, observational comparisons — not overstated A/B claims."
        breadcrumbs={[
          { label: "Growth", href: "/growth" },
          { label: "Experiments", href: "/experiments" },
        ]}
      />

      <p className="mb-4 text-sm text-slate-600">
        Platforms do not deliver randomised tests to equivalent audiences. Results are observational and include validity warnings.
      </p>

      {message ? <p className="mb-3 text-sm text-slate-600">{message}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Experiments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.length === 0 ? (
              <p className="text-sm text-slate-600">No experiments yet.</p>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={`/experiments/${item.id}`}
                  className="block rounded border p-2 text-sm hover:bg-slate-50"
                >
                  <div className="font-medium">{item.title}</div>
                  <div className="text-xs text-slate-500">{item.status}</div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {active ? (
          <Card>
            <CardHeader>
              <CardTitle>{active.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="muted">{active.status}</Badge>
                <Badge variant="muted">{EXPERIMENT_TEST_TYPE_LABELS[active.testType]}</Badge>
                <Badge variant="muted">{active.targetProvider}</Badge>
              </div>
              {active.hypothesis ? <p>{active.hypothesis.statement}</p> : null}
              <p className="text-slate-600">
                {new Date(active.startDate).toLocaleDateString()} –{" "}
                {new Date(active.endDate).toLocaleDateString()} · {active.variants.length} variants
              </p>
              {active.validityWarnings?.length ? (
                <div className="rounded border border-amber-200 bg-amber-50 p-3">
                  <p className="font-medium">Validity warnings</p>
                  <ul className="mt-1 list-disc pl-5">
                    {active.validityWarnings.map((warning) => (
                      <li key={warning.code}>{warning.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {active.decision ? (
                <div className="rounded border p-3">
                  <p className="font-medium">Decision: {active.decision.outcome}</p>
                  {active.decision.percentageDifference ? (
                    <p>Difference: {Number(active.decision.percentageDifference).toFixed(1)}%</p>
                  ) : null}
                  <p className="text-slate-600">{active.decision.limitations}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void runAction(active.id, "ready")}>
                  Mark ready
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void runAction(active.id, "compute-results")}
                >
                  Compute results
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void reuseFinding(active.id, "CONTENT_PATTERN")}
                >
                  Save as pattern
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void reuseFinding(active.id, "GROWTH_RECOMMENDATION")}
                >
                  Create recommendation
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
