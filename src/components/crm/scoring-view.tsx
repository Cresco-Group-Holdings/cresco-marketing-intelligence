"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";
import {
  ALL_SIGNALS,
  MODEL_STATUSES,
  QUALIFICATION_STATUSES,
  SCORING_DISCLAIMER,
} from "@/lib/lead-scoring/constants";

export type ScoringViewMode =
  | "hub"
  | "models"
  | "modelDetail"
  | "simulation"
  | "qualification";

type ScoringViewProps = {
  mode: ScoringViewMode;
  modelId?: string;
};

type LeadScoreExplanationPanelProps = {
  score?: Record<string, unknown> | null;
  qualification?: Record<string, unknown> | null;
  override?: Record<string, unknown> | null;
  loading?: boolean;
  onOverride?: (status: string, reason: string) => void;
  onScoreLead?: () => void;
  compact?: boolean;
};

function qualificationBadgeVariant(status: string): "default" | "muted" {
  if (status === "HOT" || status === "QUALIFIED") return "default";
  return "muted";
}

export function LeadScoreExplanationPanel({
  score,
  qualification,
  override: scoreOverride,
  loading,
  onOverride,
  onScoreLead,
  compact,
}: LeadScoreExplanationPanelProps) {
  const [overrideStatus, setOverrideStatus] = useState("QUALIFIED");
  const [overrideReason, setOverrideReason] = useState("");

  const breakdown = score?.breakdown as Record<string, Record<string, unknown>> | undefined;
  const evidence = (score?.evidence as Array<Record<string, unknown>>) ?? [];
  const matchedEvidence = evidence.filter((e) => e.matched);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">Loading score…</p>
        </CardContent>
      </Card>
    );
  }

  if (!score && !qualification) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className={compact ? "text-base" : undefined}>Lead score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">No score computed yet for this lead.</p>
          {onScoreLead ? (
            <Button size="sm" variant="outline" onClick={onScoreLead}>
              Compute score
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className={compact ? "text-base" : undefined}>Lead score</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xl font-semibold">
            {score?.compositeScore != null ? String(score.compositeScore) : "—"}
          </span>
          {qualification?.status ? (
            <Badge variant={qualificationBadgeVariant(String(qualification.status))}>
              {String(qualification.status)}
            </Badge>
          ) : null}
          {qualification?.confidence ? (
            <Badge variant="muted">{String(qualification.confidence)} confidence</Badge>
          ) : null}
          {scoreOverride ? <Badge variant="muted">Manual override</Badge> : null}
        </div>

        {breakdown ? (
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fit</span>
              <span>{String((breakdown.fit as Record<string, unknown>)?.decayedPoints ?? score?.fitScore ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Engagement</span>
              <span>{String((breakdown.engagement as Record<string, unknown>)?.decayedPoints ?? score?.engagementScore ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Negative</span>
              <span>{String((breakdown.negative as Record<string, unknown>)?.decayedPoints ?? score?.negativeScore ?? 0)}</span>
            </div>
          </div>
        ) : null}

        {qualification?.reasons && (qualification.reasons as string[]).length > 0 ? (
          <div>
            <h4 className="text-sm font-medium mb-1">Qualification</h4>
            {(qualification.reasons as string[]).map((reason, i) => (
              <p key={i} className="text-sm text-muted-foreground">{reason}</p>
            ))}
          </div>
        ) : null}

        {qualification?.missingFields && (qualification.missingFields as string[]).length > 0 ? (
          <div>
            <h4 className="text-sm font-medium mb-1">Missing info</h4>
            <p className="text-sm text-muted-foreground">
              {(qualification.missingFields as string[]).join(", ")}
            </p>
          </div>
        ) : null}

        {matchedEvidence.length > 0 ? (
          <div>
            <h4 className="text-sm font-medium mb-2">Matched rules ({matchedEvidence.length})</h4>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {matchedEvidence.map((e, i) => (
                <div key={String(e.ruleId ?? i)} className="flex justify-between text-sm border-b py-1">
                  <span>{String(e.label ?? e.signal)}</span>
                  <span className={Number(e.points) < 0 ? "text-red-600" : ""}>
                    {Number(e.points) > 0 ? "+" : ""}{String(e.cappedPoints ?? e.points)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {score?.computedAt ? (
          <p className="text-xs text-muted-foreground">
            Computed {new Date(String(score.computedAt)).toLocaleString()}
            {score.scoreVersion ? ` · v${String(score.scoreVersion)}` : ""}
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">{SCORING_DISCLAIMER}</p>

        {onOverride ? (
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-sm font-medium">Manual override</h4>
            <Input
              label="Override status"
              value={overrideStatus}
              onChange={(e) => setOverrideStatus(e.target.value)}
              placeholder="QUALIFIED"
              hint={`Options: ${QUALIFICATION_STATUSES.join(", ")}`}
            />
            <Input
              label="Reason"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Sales confirmed fit"
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={!overrideReason.trim()}
              onClick={() => onOverride(overrideStatus, overrideReason)}
            >
              Apply override
            </Button>
          </div>
        ) : null}

        {onScoreLead ? (
          <Button size="sm" variant="outline" className="w-full" onClick={onScoreLead}>
            Recompute score
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ScoringView({ mode, modelId }: ScoringViewProps) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const base = brandId ? `/api/brands/${brandId}/crm/scoring` : null;

  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [models, setModels] = useState<Array<Record<string, unknown>>>([]);
  const [model, setModel] = useState<Record<string, unknown> | null>(null);
  const [version, setVersion] = useState<Record<string, unknown> | null>(null);
  const [simulation, setSimulation] = useState<Record<string, unknown> | null>(null);
  const [qualificationConfig, setQualificationConfig] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [modelName, setModelName] = useState("");
  const [rulesJson, setRulesJson] = useState(
    JSON.stringify({ ruleGroups: [] }, null, 2),
  );
  const [simulationModelId, setSimulationModelId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [overrideStatus, setOverrideStatus] = useState("QUALIFIED");
  const [overrideReason, setOverrideReason] = useState("");
  const [scoreResult, setScoreResult] = useState<Record<string, unknown> | null>(null);
  const [qualificationResult, setQualificationResult] = useState<Record<string, unknown> | null>(null);

  const loadData = useCallback(async () => {
    if (!base || !organisationId) return;
    setLoading(true);
    try {
      if (mode === "hub") {
        const res = await apiFetch<{ dashboard: Record<string, unknown> }>(
          `${base}?organisationId=${organisationId}`,
        );
        setDashboard(res.dashboard);
      } else if (mode === "models") {
        const res = await apiFetch<{ models: Array<Record<string, unknown>> }>(
          `${base}?organisationId=${organisationId}&view=models`,
        );
        setModels(res.models);
      } else if (mode === "modelDetail" && modelId) {
        const res = await apiFetch<{
          model: Record<string, unknown>;
          version?: Record<string, unknown>;
        }>(`${base}?organisationId=${organisationId}&modelId=${modelId}`);
        setModel(res.model);
        const v = res.version ?? (res.model.activeVersion as Record<string, unknown> | undefined);
        setVersion(v ?? null);
        if (v) {
          const ruleGroups = v.ruleGroups ?? [];
          setRulesJson(JSON.stringify({ ruleGroups }, null, 2));
        }
      } else if (mode === "simulation") {
        const res = await apiFetch<{
          models: Array<Record<string, unknown>>;
          activeModelId?: string;
        }>(`${base}?organisationId=${organisationId}&view=simulation`);
        setModels(res.models);
        if (res.activeModelId) setSimulationModelId(res.activeModelId);
        else if (res.models[0]) setSimulationModelId(String(res.models[0].id));
      } else if (mode === "qualification") {
        const res = await apiFetch<{ qualification: Record<string, unknown> }>(
          `${base}?organisationId=${organisationId}&view=qualification`,
        );
        setQualificationConfig(res.qualification);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load scoring data.");
    } finally {
      setLoading(false);
    }
  }, [base, organisationId, mode, modelId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function postAction(body: Record<string, unknown>) {
    if (!base || !organisationId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiFetch<Record<string, unknown>>(`${base}?organisationId=${organisationId}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.simulation) setSimulation(res.simulation as Record<string, unknown>);
      if (res.score) setScoreResult(res.score as Record<string, unknown>);
      if (res.qualification) setQualificationResult(res.qualification as Record<string, unknown>);
      setMessage("Action completed.");
      await loadData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  const parsedRules = (() => {
    try {
      return JSON.parse(rulesJson) as { ruleGroups: Array<Record<string, unknown>> };
    } catch {
      return { ruleGroups: [] };
    }
  })();

  const nav = modelId ? (
    <nav className="flex flex-wrap gap-2 border-b pb-3 mb-6">
      <Link
        href={`/crm/scoring/models/${modelId}`}
        className={`rounded-md px-3 py-1.5 text-sm ${mode === "modelDetail" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
      >
        Rules
      </Link>
      <Link
        href="/crm/scoring/simulation"
        className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
      >
        Simulation
      </Link>
    </nav>
  ) : (
    <nav className="flex flex-wrap gap-2 border-b pb-3 mb-6">
      <Link
        href="/crm/scoring"
        className={`rounded-md px-3 py-1.5 text-sm ${mode === "hub" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
      >
        Hub
      </Link>
      <Link
        href="/crm/scoring/models"
        className={`rounded-md px-3 py-1.5 text-sm ${mode === "models" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
      >
        Models
      </Link>
      <Link
        href="/crm/scoring/simulation"
        className={`rounded-md px-3 py-1.5 text-sm ${mode === "simulation" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
      >
        Simulation
      </Link>
      <Link
        href="/crm/qualification"
        className={`rounded-md px-3 py-1.5 text-sm ${mode === "qualification" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
      >
        Qualification
      </Link>
    </nav>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Scoring"
        description="Deterministic rule-based lead scoring with qualification thresholds, simulation, and manual overrides."
      />
      {nav}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {mode === "hub" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Models</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">
                {dashboard?.modelsCount != null ? String(dashboard.modelsCount) : "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Active model</CardTitle></CardHeader>
              <CardContent className="text-sm font-medium">
                {dashboard?.activeModelName ? String(dashboard.activeModelName) : "None"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Scored leads</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">
                {dashboard?.scoredLeads != null ? String(dashboard.scoredLeads) : "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Pending review</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">
                {dashboard?.pendingReview != null ? String(dashboard.pendingReview) : "—"}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Scoring models</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Define fit, engagement, and negative signal rules with caps and decay.
                </p>
                <Link href="/crm/scoring/models"><Button variant="outline">Manage models</Button></Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Simulation</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Preview score distribution and qualification changes before activation.
                </p>
                <Link href="/crm/scoring/simulation"><Button variant="outline">Run simulation</Button></Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Qualification</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Review thresholds, status mapping, and override policies.
                </p>
                <Link href="/crm/qualification"><Button variant="outline">View qualification</Button></Link>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">{SCORING_DISCLAIMER}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "models" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Create scoring model</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <Input label="Model name" value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="Default lead scoring" />
              <Button
                onClick={async () => {
                  const res = await apiFetch<{ model: { id: string } }>(`${base}?organisationId=${organisationId}`, {
                    method: "POST",
                    body: JSON.stringify({ action: "createModel", name: modelName }),
                  });
                  window.location.href = `/crm/scoring/models/${res.model.id}`;
                }}
                disabled={!modelName.trim()}
              >
                Create model
              </Button>
            </CardContent>
          </Card>

          {models.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">No scoring models yet.</p>
          ) : null}
          {models.map((m) => (
            <Card key={String(m.id)}>
              <CardContent className="py-4 flex justify-between items-center">
                <div>
                  <Link href={`/crm/scoring/models/${m.id}`} className="font-medium hover:underline">
                    {String(m.name)}
                  </Link>
                  {m.description ? (
                    <p className="text-sm text-muted-foreground">{String(m.description)}</p>
                  ) : null}
                </div>
                <div className="flex gap-2 items-center">
                  {m.isActive ? <Badge>Active</Badge> : null}
                  <Badge variant="muted">{String(m.status ?? "DRAFT")}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {mode === "modelDetail" && model && modelId && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>{String(model.name)}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge>{String(model.status ?? "DRAFT")}</Badge>
                  {model.isActive ? <Badge variant="muted">Active</Badge> : null}
                </div>
                {model.description ? <p className="text-sm">{String(model.description)}</p> : null}
                {version ? (
                  <p className="text-sm text-muted-foreground">
                    Version v{String(version.versionNumber ?? version.version)} — {String(version.status ?? "DRAFT")}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No version yet.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Lifecycle</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => postAction({ action: "approveVersion", modelId })}
                >
                  Approve version
                </Button>
                <Button
                  className="w-full"
                  onClick={() => postAction({ action: "activateVersion", modelId })}
                >
                  Activate version
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Rule groups ({parsedRules.ruleGroups.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {parsedRules.ruleGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No rule groups defined.</p>
                ) : (
                  parsedRules.ruleGroups.map((group, i) => (
                    <div key={String(group.id ?? i)} className="flex justify-between text-sm border-b py-2">
                      <span>{String(group.id ?? `Group ${i + 1}`)}</span>
                      <div className="flex gap-2">
                        <Badge variant="muted">{String(group.category)}</Badge>
                        <Badge variant="muted">{String(group.logic ?? "AND")}</Badge>
                        <span className="text-muted-foreground">
                          {((group.rules as Array<unknown>) ?? []).length} rules
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Supported signals</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground font-mono">
                  {ALL_SIGNALS.slice(0, 8).join(", ")}…
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Statuses: {MODEL_STATUSES.join(", ")}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Rules (JSON)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className="w-full min-h-[240px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                value={rulesJson}
                onChange={(e) => setRulesJson(e.target.value)}
              />
              <Button
                onClick={() => postAction({
                  action: "saveRules",
                  modelId,
                  ruleGroups: parsedRules.ruleGroups,
                })}
              >
                Save rules
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Score single lead</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <Input label="Lead ID" value={leadId} onChange={(e) => setLeadId(e.target.value)} />
              <Button
                variant="outline"
                onClick={() => postAction({ action: "scoreLead", modelId, leadId })}
                disabled={!leadId.trim()}
              >
                Score lead
              </Button>
              {scoreResult || qualificationResult ? (
                <LeadScoreExplanationPanel
                  score={scoreResult}
                  qualification={qualificationResult}
                  compact
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "simulation" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Run simulation</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <Input
                label="Model ID"
                value={simulationModelId}
                onChange={(e) => setSimulationModelId(e.target.value)}
                hint={models.length > 0 ? `${models.length} model(s) available` : undefined}
              />
              <Button
                onClick={() => postAction({ action: "runSimulation", modelId: simulationModelId })}
                disabled={!simulationModelId.trim()}
              >
                Run simulation
              </Button>
            </CardContent>
          </Card>

          {simulation ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
                <CardContent className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total leads</span>
                    <span>{String(simulation.totalLeads ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Affected</span>
                    <span>{String(simulation.affectedLeadCount ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average score</span>
                    <span>{String(simulation.averageCompositeScore ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Median score</span>
                    <span>{String(simulation.medianCompositeScore ?? 0)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Score distribution</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {((simulation.scoreDistribution as Array<Record<string, unknown>>) ?? []).map((bucket) => (
                    <div key={String(bucket.range)} className="flex justify-between text-sm border-b py-2">
                      <span>{String(bucket.range)}</span>
                      <span>{String(bucket.count)} leads</span>
                    </div>
                  ))}
                  {!(simulation.scoreDistribution as Array<unknown>)?.length ? (
                    <p className="text-sm text-muted-foreground">No distribution data.</p>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>Status changes</CardTitle></CardHeader>
                <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                  {((simulation.statusChanges as Array<Record<string, unknown>>) ?? []).map((change, i) => (
                    <div key={String(change.leadId ?? i)} className="flex justify-between text-sm border-b py-2">
                      <span>{String(change.leadId)}</span>
                      <div className="flex gap-2 items-center">
                        <Badge variant="muted">{String(change.previousStatus)}</Badge>
                        <span>→</span>
                        <Badge>{String(change.newStatus)}</Badge>
                        <span className="text-muted-foreground">
                          {String(change.previousScore)} → {String(change.newScore)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {!(simulation.statusChanges as Array<unknown>)?.length ? (
                    <p className="text-sm text-muted-foreground">No status changes predicted.</p>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>High-impact rules</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {((simulation.highImpactRules as Array<Record<string, unknown>>) ?? []).map((rule, i) => (
                    <div key={String(rule.ruleId ?? i)} className="flex justify-between text-sm border-b py-2">
                      <span>{String(rule.label ?? rule.signal)}</span>
                      <div className="flex gap-3 text-muted-foreground">
                        <span>{String(rule.matchCount)} matches</span>
                        <span>{String(rule.totalPointsContributed)} pts</span>
                      </div>
                    </div>
                  ))}
                  {!(simulation.highImpactRules as Array<unknown>)?.length ? (
                    <p className="text-sm text-muted-foreground">No high-impact rules identified.</p>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      )}

      {mode === "qualification" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Qualification thresholds</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {qualificationConfig?.thresholds ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {Object.entries(qualificationConfig.thresholds as Record<string, { min: number; max: number }>).map(
                    ([status, threshold]) => (
                      <div key={status} className="flex justify-between text-sm border-b py-2">
                        <Badge variant={qualificationBadgeVariant(status)}>{status}</Badge>
                        <span className="text-muted-foreground">
                          {threshold.min} – {threshold.max}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {QUALIFICATION_STATUSES.filter((s) => !["UNASSESSED", "NEEDS_INFO"].includes(s)).map((status) => (
                    <div key={status} className="flex justify-between text-sm border-b py-2">
                      <Badge variant="muted">{status}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {qualificationConfig?.activeModelName ? (
                <p className="text-sm text-muted-foreground">
                  Active model: {String(qualificationConfig.activeModelName)}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Status reference</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {QUALIFICATION_STATUSES.map((status) => (
                <div key={status} className="flex items-center gap-2 text-sm">
                  <Badge variant={qualificationBadgeVariant(status)}>{status}</Badge>
                  <span className="text-muted-foreground">
                    {status === "NEEDS_INFO" && "Required fields missing"}
                    {status === "COLD" && "Low fit or engagement"}
                    {status === "WARM" && "Moderate interest"}
                    {status === "HOT" && "Strong interest, ready for outreach"}
                    {status === "QUALIFIED" && "Meets qualification threshold"}
                    {status === "DISQUALIFIED" && "Excluded from active pipeline"}
                    {status === "UNASSESSED" && "Not yet scored"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Manual override</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <p className="text-sm text-muted-foreground">
                Overrides apply from the lead detail page. Sales can set qualification status with a documented reason.
              </p>
              <Input label="Lead ID" value={leadId} onChange={(e) => setLeadId(e.target.value)} />
              <Input label="Override status" value={overrideStatus} onChange={(e) => setOverrideStatus(e.target.value)} placeholder="QUALIFIED" />
              <Input label="Reason" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Sales confirmed fit" />
              <Button
                onClick={() => postAction({
                  action: "applyOverride",
                  leadId,
                  status: overrideStatus,
                  reason: overrideReason,
                })}
                disabled={!leadId.trim() || !overrideReason.trim()}
              >
                Apply override
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">{SCORING_DISCLAIMER}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
