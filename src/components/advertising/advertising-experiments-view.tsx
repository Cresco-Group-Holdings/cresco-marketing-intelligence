"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";
import { SUPPORTED_EXPERIMENT_TYPES } from "@/lib/advertising-experiments/constants";

export type AdvertisingExperimentsViewMode = "list" | "new" | "detail" | "results" | "validity";

function ExperimentsNav({ active, experimentId }: { active: AdvertisingExperimentsViewMode; experimentId?: string }) {
  const tabs: Array<{ mode: AdvertisingExperimentsViewMode; label: string; href: string }> = [
    { mode: "list", label: "Experiments", href: "/advertising/experiments" },
    { mode: "new", label: "New", href: "/advertising/experiments/new" },
  ];
  if (experimentId) {
    tabs.push(
      { mode: "detail", label: "Detail", href: `/advertising/experiments/${experimentId}` },
      { mode: "results", label: "Results", href: `/advertising/experiments/${experimentId}/results` },
      { mode: "validity", label: "Validity", href: `/advertising/experiments/${experimentId}/validity` },
    );
  }
  return (
    <nav className="flex flex-wrap gap-2 border-b pb-3 mb-6">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`rounded-md px-3 py-1.5 text-sm ${active === tab.mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

const STATUS_VARIANT: Record<string, "default" | "muted" | "warning"> = {
  DRAFT: "muted",
  READY: "default",
  RUNNING: "default",
  PAUSED: "warning",
  COMPLETED: "default",
  INCONCLUSIVE: "warning",
  CANCELLED: "warning",
};

export function AdvertisingExperimentsView({
  mode,
  experimentId,
}: {
  mode: AdvertisingExperimentsViewMode;
  experimentId?: string;
}) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const base = brandId ? `/api/brands/${brandId}/advertising/experiments` : null;

  const [experiments, setExperiments] = useState<Array<Record<string, unknown>>>([]);
  const [experiment, setExperiment] = useState<Record<string, unknown> | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [validityChecks, setValidityChecks] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [experimentType, setExperimentType] = useState("CREATIVE");
  const [observedProblem, setObservedProblem] = useState("");
  const [proposedChange, setProposedChange] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [primaryMetric, setPrimaryMetric] = useState("ctr");
  const [audience, setAudience] = useState("");
  const [durationDays, setDurationDays] = useState("14");
  const [minimumVolume, setMinimumVolume] = useState("1000");
  const [decisionRule, setDecisionRule] = useState("Adopt variant if CTR improves by ≥5% with no guardrail violations.");

  const loadList = useCallback(async () => {
    if (!base || !organisationId) return;
    const res = await apiFetch<{ experiments: Array<Record<string, unknown>> }>(`${base}?organisationId=${organisationId}`);
    setExperiments(res.experiments);
  }, [base, organisationId]);

  const loadExperiment = useCallback(async () => {
    if (!base || !organisationId || !experimentId) return;
    const res = await apiFetch<{ experiment: Record<string, unknown> }>(`${base}/${experimentId}?organisationId=${organisationId}`);
    setExperiment(res.experiment);
  }, [base, organisationId, experimentId]);

  const loadAnalysis = useCallback(async () => {
    if (!base || !organisationId || !experimentId) return;
    const res = await apiFetch<Record<string, unknown>>(`${base}/${experimentId}?organisationId=${organisationId}`, {
      method: "POST",
      body: JSON.stringify({ action: "analyze" }),
    });
    setAnalysis(res.analysis as Record<string, unknown>);
    setValidityChecks((res.validityChecks as Array<Record<string, unknown>>) ?? []);
  }, [base, organisationId, experimentId]);

  const loadValidity = useCallback(async () => {
    if (!base || !organisationId || !experimentId) return;
    const res = await apiFetch<{ checks: Array<Record<string, unknown>> }>(`${base}/${experimentId}?organisationId=${organisationId}`, {
      method: "POST",
      body: JSON.stringify({ action: "run-validity-checks" }),
    });
    setValidityChecks(res.checks);
  }, [base, organisationId, experimentId]);

  useEffect(() => {
    if (mode === "list") loadList();
    if (mode === "detail" && experimentId) loadExperiment();
    if (mode === "results" && experimentId) loadAnalysis();
    if (mode === "validity" && experimentId) loadValidity();
  }, [mode, experimentId, loadList, loadExperiment, loadAnalysis, loadValidity]);

  const createExperiment = async () => {
    if (!base || !organisationId) return;
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch(`${base}?organisationId=${organisationId}`, {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          title,
          experimentType,
          hypothesis: {
            observedProblem,
            proposedChange,
            expectedOutcome,
            primaryMetric,
            guardrailMetrics: ["cpa"],
            audience,
            durationDays: Number(durationDays),
            minimumVolume: Number(minimumVolume),
            decisionRule,
          },
          variants: [
            { variantType: "CONTROL", label: "Control", documentedVariables: { creative: "baseline" } },
            { variantType: "TREATMENT", label: "Treatment A", documentedVariables: { creative: "variant_a" } },
          ],
          metrics: [
            { metricKey: primaryMetric, role: "PRIMARY", label: primaryMetric.toUpperCase() },
            { metricKey: "cpa", role: "GUARDRAIL", label: "CPA" },
          ],
          allocation: { allocationType: "EQUAL" },
        }),
      });
      setMessage("Experiment created.");
      await loadList();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to create experiment.");
    } finally {
      setLoading(false);
    }
  };

  const markReady = async () => {
    if (!base || !organisationId || !experimentId) return;
    setLoading(true);
    try {
      await apiFetch(`${base}/${experimentId}?organisationId=${organisationId}`, {
        method: "POST",
        body: JSON.stringify({ action: "mark-ready" }),
      });
      setMessage("Experiment marked ready.");
      await loadExperiment();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Advertising Experiments"
        description="Rigorous A/B testing for creatives, audiences, offers, and campaign configurations."
      />
      <ExperimentsNav active={mode} experimentId={experimentId} />
      {message && <p className="mb-4 text-sm text-muted-foreground">{message}</p>}

      {mode === "list" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Experiments</CardTitle>
            <ButtonLink href="/advertising/experiments/new">New experiment</ButtonLink>
          </CardHeader>
          <CardContent>
            {experiments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No experiments yet.</p>
            ) : (
              <ul className="space-y-2">
                {experiments.map((exp) => (
                  <li key={exp.id as string} className="flex items-center justify-between border-b pb-2 text-sm">
                    <Link href={`/advertising/experiments/${exp.id as string}`} className="hover:underline">
                      {exp.title as string}
                    </Link>
                    <div className="flex gap-2">
                      <Badge variant="muted">{exp.experimentType as string}</Badge>
                      <Badge variant={STATUS_VARIANT[exp.status as string] ?? "muted"}>{exp.status as string}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "new" && (
        <Card>
          <CardHeader><CardTitle>Design experiment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Q3 creative test" />
            <div>
              <label className="text-sm font-medium">Experiment type</label>
              <select className="mt-1 w-full rounded border p-2 text-sm" value={experimentType} onChange={(e) => setExperimentType(e.target.value)}>
                {SUPPORTED_EXPERIMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <Input label="Observed problem" value={observedProblem} onChange={(e) => setObservedProblem(e.target.value)} placeholder="CTR below benchmark" />
            <Input label="Proposed change" value={proposedChange} onChange={(e) => setProposedChange(e.target.value)} placeholder="Test new headline" />
            <Input label="Expected outcome" value={expectedOutcome} onChange={(e) => setExpectedOutcome(e.target.value)} placeholder="CTR increase" />
            <Input label="Primary metric" value={primaryMetric} onChange={(e) => setPrimaryMetric(e.target.value)} placeholder="ctr" />
            <Input label="Audience" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="US 25-54 interest: marketing" />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Duration (days)" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
              <Input label="Minimum volume" value={minimumVolume} onChange={(e) => setMinimumVolume(e.target.value)} />
            </div>
            <Input label="Decision rule" value={decisionRule} onChange={(e) => setDecisionRule(e.target.value)} />
            <Button onClick={createExperiment} disabled={loading}>Create experiment</Button>
          </CardContent>
        </Card>
      )}

      {mode === "detail" && experiment && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>{experiment.title as string}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Type: {experiment.experimentType as string}</p>
              <p>Status: <Badge variant={STATUS_VARIANT[experiment.status as string] ?? "muted"}>{experiment.status as string}</Badge></p>
              {(experiment.hypothesis as Record<string, unknown>) && (
                <>
                  <p>Problem: {(experiment.hypothesis as Record<string, unknown>).observedProblem as string}</p>
                  <p>Primary metric: {(experiment.hypothesis as Record<string, unknown>).primaryMetric as string}</p>
                  <p>Decision rule: {(experiment.hypothesis as Record<string, unknown>).decisionRule as string}</p>
                </>
              )}
              {experiment.status === "DRAFT" && (
                <Button onClick={markReady} disabled={loading}>Mark ready</Button>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Variants</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {((experiment.variants as Array<Record<string, unknown>>) ?? []).map((v) => (
                  <li key={v.id as string}>{v.label as string} — {v.variantType as string}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "results" && analysis && (
        <Card>
          <CardHeader><CardTitle>Analysis results</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{analysis.observedResult as string}</p>
            <p>Absolute difference: {String(analysis.absoluteDifference)}</p>
            <p>Relative difference: {analysis.relativeDifference != null ? `${Number(analysis.relativeDifference).toFixed(1)}%` : "N/A"}</p>
            <p>Recommendation: <Badge>{analysis.recommendation as string}</Badge></p>
            <p className="text-muted-foreground">{analysis.disclaimer as string}</p>
          </CardContent>
        </Card>
      )}

      {mode === "validity" && (
        <Card>
          <CardHeader><CardTitle>Validity checks</CardTitle></CardHeader>
          <CardContent>
            {validityChecks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No validity checks run yet.</p>
            ) : (
              <ul className="space-y-2">
                {validityChecks.map((check, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Badge variant={check.severity === "CRITICAL" ? "warning" : "muted"}>{check.severity as string}</Badge>
                    <span>{check.message as string}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
