"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";
import {
  FEEDBACK_STATUSES,
  LIFECYCLE_DISCLAIMER,
  NO_AUTONOMOUS_ACTION_DISCLAIMER,
} from "@/lib/lifecycle-agent/constants";

export type AssistantViewMode =
  | "hub"
  | "findings"
  | "recommendations"
  | "drafts"
  | "history";

type AssistantViewProps = {
  mode: AssistantViewMode;
};

type LifecycleRecommendationPanelProps = {
  leadId?: string;
  opportunityId?: string;
  loading?: boolean;
  compact?: boolean;
};

function severityBadgeVariant(severity: string): "default" | "muted" | "warning" {
  if (severity === "CRITICAL") return "default";
  if (severity === "WARNING") return "warning";
  return "muted";
}

function priorityBadgeVariant(band: string): "default" | "muted" | "warning" {
  if (band === "CRITICAL" || band === "HIGH") return "default";
  if (band === "MEDIUM") return "warning";
  return "muted";
}

function priorityBandFromScore(score: number | null | undefined): string {
  if (score == null) return "MEDIUM";
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function isFindingSuppressed(limitations: unknown): boolean {
  if (!limitations || typeof limitations !== "object") return false;
  const lim = limitations as Record<string, unknown>;
  return lim.suppressed === true;
}

function findingEntityId(f: Record<string, unknown>): string | null {
  return (f.crmLeadId ?? f.crmOpportunityId ?? f.crmRecordId ?? f.entityId) as string | null;
}

function findingEntityType(f: Record<string, unknown>): string {
  if (f.crmLeadId) return "lead";
  if (f.crmOpportunityId) return "opportunity";
  return String(f.crmRecordType ?? f.entityType ?? "portfolio");
}

function normalizeFinding(f: Record<string, unknown>): Record<string, unknown> {
  const evidenceItems = (f.evidence as Array<Record<string, unknown>>) ?? [];
  const evidenceRecord =
    evidenceItems.length > 0
      ? Object.fromEntries(
          evidenceItems.flatMap((e, i) => [
            [`evidence_${i}_type`, e.crmRecordType ?? "record"],
            [`evidence_${i}_activities`, JSON.stringify(e.activities ?? e.scoreSnapshot ?? {})],
          ]),
        )
      : (f.evidence as Record<string, unknown> | undefined);

  return {
    ...f,
    entityId: findingEntityId(f),
    entityType: findingEntityType(f),
    suppressed: isFindingSuppressed(f.limitations),
    suppressionReason:
      f.limitations && typeof f.limitations === "object"
        ? (f.limitations as Record<string, unknown>).suppressionReason
        : f.suppressionReason,
    evidence: evidenceRecord,
  };
}

function normalizeRecommendation(rec: Record<string, unknown>): Record<string, unknown> {
  const proposals = (rec.actionProposals as Array<Record<string, unknown>>) ?? [];
  const priorityScore = rec.priorityScore as number | null | undefined;
  return {
    ...rec,
    priorityBand: rec.priorityBand ?? priorityBandFromScore(priorityScore),
    actionProposal: proposals[0] ?? rec.actionProposal,
    drafts: rec.drafts ?? [],
  };
}

function normalizeDraft(draft: Record<string, unknown>): Record<string, unknown> {
  const warnings = Array.isArray(draft.safetyWarnings)
    ? (draft.safetyWarnings as string[])
    : draft.warnings
      ? (draft.warnings as string[])
      : [];
  return {
    ...draft,
    warnings,
    safe: warnings.length === 0 && !(draft.errors as string[] | undefined)?.length,
  };
}

function defaultDateRange(): { dateRangeStart: string; dateRangeEnd: string } {
  const dateRangeEnd = new Date().toISOString();
  const dateRangeStart = new Date(Date.now() - 30 * 86_400_000).toISOString();
  return { dateRangeStart, dateRangeEnd };
}

function EvidenceBlock({ evidence }: { evidence: Record<string, unknown> | null | undefined }) {
  if (!evidence || Object.keys(evidence).length === 0) {
    return <p className="text-sm text-muted-foreground">No evidence attached.</p>;
  }
  return (
    <div className="space-y-1 max-h-40 overflow-y-auto rounded-md bg-muted/40 p-2 text-xs font-mono">
      {Object.entries(evidence).map(([key, value]) => (
        <div key={key} className="flex justify-between gap-2 border-b border-muted py-1 last:border-0">
          <span className="text-muted-foreground">{key}</span>
          <span className="text-right break-all">{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
        </div>
      ))}
    </div>
  );
}

function SafetyWarnings({
  warnings,
  errors,
  blockedReasons,
}: {
  warnings?: string[];
  errors?: string[];
  blockedReasons?: string[];
}) {
  const allWarnings = warnings ?? [];
  const allErrors = [...(errors ?? []), ...(blockedReasons ?? [])];
  if (allWarnings.length === 0 && allErrors.length === 0) return null;
  return (
    <div className="space-y-2">
      {allErrors.map((msg, i) => (
        <p key={`err-${i}`} className="text-sm text-red-600">{msg}</p>
      ))}
      {allWarnings.map((msg, i) => (
        <p key={`warn-${i}`} className="text-sm text-amber-700">{msg}</p>
      ))}
    </div>
  );
}

function FeedbackForm({
  recommendationId,
  onSubmit,
  disabled,
}: {
  recommendationId: string;
  onSubmit: (status: string, explanation: string) => void;
  disabled?: boolean;
}) {
  const [status, setStatus] = useState("ACCEPTED");
  const [explanation, setExplanation] = useState("");

  return (
    <div className="space-y-2 pt-2 border-t">
      <h4 className="text-sm font-medium">Feedback</h4>
      <Input
        label="Status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        placeholder="ACCEPTED"
        hint={`Options: ${FEEDBACK_STATUSES.join(", ")}`}
      />
      <Input
        label="Explanation"
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        placeholder={status === "REJECTED" ? "Required for rejection" : "Optional notes"}
      />
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        disabled={disabled || (status === "REJECTED" && !explanation.trim())}
        onClick={() => onSubmit(status, explanation)}
      >
        Submit feedback
      </Button>
    </div>
  );
}

function useAssistantApi() {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const base = brandId ? `/api/brands/${brandId}/crm/assistant` : null;

  const fetchRuns = useCallback(async () => {
    if (!base || !organisationId) return [];
    const res = await apiFetch<{ runs: Array<Record<string, unknown>> }>(
      `${base}?organisationId=${organisationId}`,
    );
    return res.runs ?? [];
  }, [base, organisationId]);

  const fetchFindings = useCallback(
    async (runId: string) => {
      if (!base || !organisationId) return [];
      const res = await apiFetch<{ findings: Array<Record<string, unknown>> }>(
        `${base}?organisationId=${organisationId}&view=findings&runId=${runId}`,
      );
      return (res.findings ?? []).map(normalizeFinding);
    },
    [base, organisationId],
  );

  const fetchRecommendations = useCallback(
    async (runId: string) => {
      if (!base || !organisationId) return [];
      const res = await apiFetch<{ recommendations: Array<Record<string, unknown>> }>(
        `${base}?organisationId=${organisationId}&view=recommendations&runId=${runId}`,
      );
      return (res.recommendations ?? []).map(normalizeRecommendation);
    },
    [base, organisationId],
  );

  const postAction = useCallback(
    async (body: Record<string, unknown>) => {
      if (!base || !organisationId) return;
      return apiFetch(`${base}?organisationId=${organisationId}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    [base, organisationId],
  );

  return { brandId, organisationId, base, fetchRuns, fetchFindings, fetchRecommendations, postAction };
}

export function LifecycleRecommendationPanel({
  leadId,
  opportunityId,
  loading: externalLoading,
  compact,
}: LifecycleRecommendationPanelProps) {
  const { base, fetchRuns, fetchFindings, fetchRecommendations, postAction } = useAssistantApi();
  const [findings, setFindings] = useState<Array<Record<string, unknown>>>([]);
  const [recommendations, setRecommendations] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!base || (!leadId && !opportunityId)) return;
    setLoading(true);
    try {
      const runs = await fetchRuns();
      const latestRun = runs[0];
      if (!latestRun?.id) {
        setFindings([]);
        setRecommendations([]);
        return;
      }
      const [allFindings, allRecs] = await Promise.all([
        fetchFindings(String(latestRun.id)),
        fetchRecommendations(String(latestRun.id)),
      ]);
      const entityFindings = allFindings.filter((f) => {
        if (leadId) return f.crmLeadId === leadId || f.entityId === leadId;
        if (opportunityId) return f.crmOpportunityId === opportunityId || f.entityId === opportunityId;
        return true;
      });
      const entityRecs = allRecs.filter((rec) => {
        const finding = rec.finding as Record<string, unknown> | undefined;
        if (leadId) {
          return finding?.crmLeadId === leadId || rec.crmLeadId === leadId;
        }
        if (opportunityId) {
          return finding?.crmOpportunityId === opportunityId || rec.crmOpportunityId === opportunityId;
        }
        return true;
      });
      setFindings(entityFindings);
      setRecommendations(entityRecs);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load assistant data.");
    } finally {
      setLoading(false);
    }
  }, [base, leadId, opportunityId, fetchRuns, fetchFindings, fetchRecommendations]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAction(body: Record<string, unknown>) {
    setLoading(true);
    setMessage(null);
    try {
      await postAction(body);
      setMessage("Action completed.");
      await loadData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  async function startEntityAnalysis() {
    const { dateRangeStart, dateRangeEnd } = defaultDateRange();
    const scope = leadId
      ? { leadIds: [leadId] }
      : opportunityId
        ? { opportunityIds: [opportunityId] }
        : undefined;
    await handleAction({
      action: "startRun",
      reviewType: "ON_DEMAND",
      dateRangeStart,
      dateRangeEnd,
      scope,
    });
  }

  async function generateDraft(rec: Record<string, unknown>) {
    const body = `[Draft only — review before sending]\n\n${String(rec.description ?? rec.title ?? "")}`;
    await handleAction({
      action: "createDraft",
      recommendationId: rec.id,
      draftType: "EMAIL",
      subject: String(rec.title ?? "Follow-up"),
      body,
    });
  }

  const isLoading = loading || externalLoading;

  if (!leadId && !opportunityId) return null;

  if (isLoading && findings.length === 0 && recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">Loading recommendations…</p>
        </CardContent>
      </Card>
    );
  }

  const topRecs = recommendations.slice(0, compact ? 2 : 5);
  const topFindings = findings.filter((f) => !f.suppressed).slice(0, compact ? 2 : 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className={compact ? "text-base" : undefined}>Sales assistant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

        {topFindings.length > 0 ? (
          <div>
            <h4 className="text-sm font-medium mb-2">Findings</h4>
            <div className="space-y-2">
              {topFindings.map((f) => (
                <div key={String(f.id)} className="border-b pb-2 last:border-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{String(f.title)}</span>
                    <Badge variant={severityBadgeVariant(String(f.severity ?? "INFO"))}>
                      {String(f.severity ?? "INFO")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{String(f.description)}</p>
                  <EvidenceBlock evidence={f.evidence as Record<string, unknown> | undefined} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active findings for this record.</p>
        )}

        {topRecs.length > 0 ? (
          <div>
            <h4 className="text-sm font-medium mb-2">Recommendations</h4>
            <div className="space-y-3">
              {topRecs.map((rec) => {
                const recDrafts = ((rec.drafts as Array<Record<string, unknown>>) ?? []).map(normalizeDraft);
                const actionProposal = rec.actionProposal as Record<string, unknown> | undefined;
                return (
                  <div key={String(rec.id)} className="rounded-md border p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{String(rec.title)}</span>
                      {rec.priorityBand ? (
                        <Badge variant={priorityBadgeVariant(String(rec.priorityBand))}>
                          {String(rec.priorityBand)}
                        </Badge>
                      ) : null}
                      {rec.priorityScore != null ? (
                        <Badge variant="muted">Score {String(rec.priorityScore)}</Badge>
                      ) : null}
                      {rec.requiresApproval ? <Badge variant="warning">Approval required</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{String(rec.description)}</p>

                    {recDrafts.map((draft) => (
                      <div key={String(draft.id)} className="rounded bg-muted/30 p-2 space-y-1">
                        <div className="flex gap-2 items-center">
                          <Badge variant="muted">{String(draft.draftType ?? "DRAFT")}</Badge>
                          {draft.subject ? <span className="text-sm font-medium">{String(draft.subject)}</span> : null}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{String(draft.body ?? "")}</p>
                        <SafetyWarnings warnings={draft.warnings as string[] | undefined} />
                      </div>
                    ))}

                    {actionProposal ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading || actionProposal.status === "REJECTED"}
                          onClick={() =>
                            handleAction({
                              action: "approveAction",
                              actionProposalId: actionProposal.id,
                            })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          onClick={() =>
                            handleAction({
                              action: "rejectAction",
                              actionProposalId: actionProposal.id,
                            })
                          }
                        >
                          Reject
                        </Button>
                        {!recDrafts.length ? (
                          <Button size="sm" variant="outline" disabled={loading} onClick={() => generateDraft(rec)}>
                            Generate draft
                          </Button>
                        ) : null}
                      </div>
                    ) : null}

                    <FeedbackForm
                      recommendationId={String(rec.id)}
                      disabled={loading}
                      onSubmit={(status, explanation) =>
                        handleAction({
                          action: "submitFeedback",
                          recommendationId: rec.id,
                          status,
                          userExplanation: explanation || undefined,
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No recommendations yet.</p>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={loading} onClick={startEntityAnalysis}>
            Run analysis
          </Button>
          <Link href="/crm/assistant">
            <Button size="sm" variant="outline">Open hub</Button>
          </Link>
        </div>

        <p className="text-xs text-muted-foreground">{LIFECYCLE_DISCLAIMER}</p>
      </CardContent>
    </Card>
  );
}

export function AssistantView({ mode }: AssistantViewProps) {
  const { base, fetchRuns, fetchFindings, fetchRecommendations, postAction } = useAssistantApi();

  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [findings, setFindings] = useState<Array<Record<string, unknown>>>([]);
  const [recommendations, setRecommendations] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedRecommendationId, setSelectedRecommendationId] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("ACCEPTED");
  const [feedbackExplanation, setFeedbackExplanation] = useState("");

  const activeRunId = selectedRunId || (runs[0]?.id ? String(runs[0].id) : "");

  const dashboard = useMemo(() => {
    const latest = runs[0];
    if (!latest) return null;
    const latestFindings = (latest.findings as Array<Record<string, unknown>>) ?? [];
    const latestRecs = (latest.recommendations as Array<Record<string, unknown>>) ?? [];
    const pendingApprovals = latestRecs.reduce((count, rec) => {
      const proposals = (rec.actionProposals as Array<Record<string, unknown>>) ?? [];
      return count + proposals.filter((p) => p.status === "PENDING").length;
    }, 0);
    const pendingDrafts = latestRecs.reduce((count, rec) => {
      return count + ((rec.drafts as Array<unknown>) ?? []).length;
    }, 0);
    return {
      runsCount: runs.length,
      openFindings: latestFindings.filter((f) => !isFindingSuppressed(f.limitations)).length,
      pendingApprovals,
      pendingDrafts,
      lastRunAt: latest.createdAt,
      lastRunSummary: latest.summary,
    };
  }, [runs]);

  const allDrafts = useMemo((): Array<Record<string, unknown>> => {
    return recommendations.flatMap((rec) =>
      ((rec.drafts as Array<Record<string, unknown>>) ?? []).map((draft) => ({
        ...normalizeDraft(draft),
        recommendationId: rec.id,
      })),
    );
  }, [recommendations]);

  const loadData = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    try {
      const loadedRuns = await fetchRuns();
      setRuns(loadedRuns);
      const runId = selectedRunId || (loadedRuns[0]?.id ? String(loadedRuns[0].id) : "");
      if (!runId) {
        setFindings([]);
        setRecommendations([]);
        return;
      }
      if (mode === "findings" || mode === "recommendations" || mode === "drafts") {
        const [loadedFindings, loadedRecs] = await Promise.all([
          mode === "findings" || mode === "drafts" ? fetchFindings(runId) : Promise.resolve([]),
          mode === "recommendations" || mode === "drafts" ? fetchRecommendations(runId) : Promise.resolve([]),
        ]);
        if (mode === "findings") setFindings(loadedFindings);
        if (mode === "recommendations") setRecommendations(loadedRecs);
        if (mode === "drafts") {
          setRecommendations(loadedRecs);
          setFindings(loadedFindings);
        }
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load assistant data.");
    } finally {
      setLoading(false);
    }
  }, [base, mode, selectedRunId, fetchRuns, fetchFindings, fetchRecommendations]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAction(body: Record<string, unknown>) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await postAction(body);
      if (body.action === "startRun" && res && typeof res === "object" && "run" in res) {
        const run = (res as { run: { id: string } }).run;
        setSelectedRunId(run.id);
      }
      setMessage("Action completed.");
      await loadData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  async function startAnalysis() {
    const { dateRangeStart, dateRangeEnd } = defaultDateRange();
    await handleAction({
      action: "startRun",
      reviewType: "ON_DEMAND",
      dateRangeStart,
      dateRangeEnd,
    });
  }

  async function generateDraft(rec: Record<string, unknown>) {
    const body = `[Draft only — review before sending]\n\n${String(rec.description ?? rec.title ?? "")}`;
    await handleAction({
      action: "createDraft",
      recommendationId: rec.id,
      draftType: "EMAIL",
      subject: String(rec.title ?? "Follow-up"),
      body,
    });
  }

  const nav = (
    <nav className="flex flex-wrap gap-2 border-b pb-3 mb-6">
      <Link
        href="/crm/assistant"
        className={`rounded-md px-3 py-1.5 text-sm ${mode === "hub" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
      >
        Hub
      </Link>
      <Link
        href="/crm/assistant/findings"
        className={`rounded-md px-3 py-1.5 text-sm ${mode === "findings" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
      >
        Findings
      </Link>
      <Link
        href="/crm/assistant/recommendations"
        className={`rounded-md px-3 py-1.5 text-sm ${mode === "recommendations" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
      >
        Recommendations
      </Link>
      <Link
        href="/crm/assistant/drafts"
        className={`rounded-md px-3 py-1.5 text-sm ${mode === "drafts" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
      >
        Drafts
      </Link>
      <Link
        href="/crm/assistant/history"
        className={`rounded-md px-3 py-1.5 text-sm ${mode === "history" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
      >
        History
      </Link>
    </nav>
  );

  const runSelector = runs.length > 0 ? (
    <div className="max-w-md">
      <Input
        label="Analysis run"
        value={activeRunId}
        onChange={(e) => setSelectedRunId(e.target.value)}
        hint={`${runs.length} run(s) available — paste run ID or use latest`}
      />
      <Button size="sm" variant="outline" className="mt-2" onClick={loadData} disabled={!activeRunId}>
        Load run
      </Button>
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Assistant"
        description="Evidence-grounded lifecycle recommendations with human approval, draft safety checks, and outcome feedback."
      />
      {nav}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {mode === "hub" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Analysis runs</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">
                {dashboard?.runsCount != null ? String(dashboard.runsCount) : "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Open findings</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">
                {dashboard?.openFindings != null ? String(dashboard.openFindings) : "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Pending approvals</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">
                {dashboard?.pendingApprovals != null ? String(dashboard.pendingApprovals) : "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Draft previews</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">
                {dashboard?.pendingDrafts != null ? String(dashboard.pendingDrafts) : "—"}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Findings</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Review evidence-backed lifecycle findings across leads and opportunities.
                </p>
                <Link href="/crm/assistant/findings"><Button variant="outline">View findings</Button></Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Recommendations</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Prioritised action proposals with approval workflows and feedback.
                </p>
                <Link href="/crm/assistant/recommendations"><Button variant="outline">View recommendations</Button></Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Drafts</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Preview message drafts with safety warnings before sending.
                </p>
                <Link href="/crm/assistant/drafts"><Button variant="outline">View drafts</Button></Link>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Run analysis</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <p className="text-sm text-muted-foreground">
                Trigger an on-demand lifecycle review across your CRM portfolio.
              </p>
              <Button onClick={startAnalysis} disabled={loading}>
                Run on-demand analysis
              </Button>
              {dashboard?.lastRunAt ? (
                <p className="text-xs text-muted-foreground">
                  Last run: {new Date(String(dashboard.lastRunAt)).toLocaleString()}
                  {dashboard.lastRunSummary ? ` — ${String(dashboard.lastRunSummary)}` : ""}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4 space-y-2">
              <p className="text-xs text-muted-foreground">{LIFECYCLE_DISCLAIMER}</p>
              <p className="text-xs text-muted-foreground">{NO_AUTONOMOUS_ACTION_DISCLAIMER}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {mode !== "hub" && mode !== "history" ? runSelector : null}

      {mode === "findings" && (
        <div className="space-y-4">
          {findings.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">No findings yet. Run an analysis from the hub.</p>
          ) : null}
          {findings.map((f) => (
            <Card key={String(f.id)}>
              <CardContent className="py-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{String(f.title)}</span>
                    <Badge variant={severityBadgeVariant(String(f.severity ?? "INFO"))}>
                      {String(f.severity ?? "INFO")}
                    </Badge>
                    {f.findingType ? <Badge variant="muted">{String(f.findingType)}</Badge> : null}
                    {f.suppressed ? <Badge variant="warning">Suppressed</Badge> : null}
                  </div>
                  {f.entityId ? (
                    <span className="text-xs text-muted-foreground">
                      {String(f.entityType)}: {String(f.entityId)}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">{String(f.description)}</p>
                {f.suppressionReason ? (
                  <p className="text-sm text-amber-700">Suppressed: {String(f.suppressionReason)}</p>
                ) : null}
                <div>
                  <h4 className="text-sm font-medium mb-1">Evidence</h4>
                  <EvidenceBlock evidence={f.evidence as Record<string, unknown> | undefined} />
                </div>
                {f.createdAt ? (
                  <p className="text-xs text-muted-foreground">
                    {new Date(String(f.createdAt)).toLocaleString()}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {mode === "recommendations" && (
        <div className="space-y-4">
          {recommendations.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">No recommendations yet.</p>
          ) : null}
          {recommendations.map((rec) => {
            const actionProposal = rec.actionProposal as Record<string, unknown> | undefined;
            return (
              <Card key={String(rec.id)}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{String(rec.title)}</span>
                    {rec.priorityBand ? (
                      <Badge variant={priorityBadgeVariant(String(rec.priorityBand))}>
                        {String(rec.priorityBand)}
                      </Badge>
                    ) : null}
                    {rec.priorityScore != null ? (
                      <Badge variant="muted">Priority {String(rec.priorityScore)}</Badge>
                    ) : null}
                    {rec.requiresApproval ? <Badge variant="warning">Approval required</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{String(rec.description)}</p>
                  {rec.recommendationType ? (
                    <Badge variant="muted">{String(rec.recommendationType)}</Badge>
                  ) : null}
                  {rec.rationale ? (
                    <p className="text-sm text-muted-foreground">{String(rec.rationale)}</p>
                  ) : null}

                  {actionProposal ? (
                    <div className="flex flex-wrap gap-2 pt-2 border-t items-center">
                      <Badge variant={actionProposal.status === "REJECTED" ? "warning" : "muted"}>
                        {String(actionProposal.status ?? "PENDING")}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading || actionProposal.status === "REJECTED"}
                        onClick={() =>
                          handleAction({
                            action: "approveAction",
                            actionProposalId: actionProposal.id,
                          })
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() =>
                          handleAction({
                            action: "rejectAction",
                            actionProposalId: actionProposal.id,
                          })
                        }
                      >
                        Reject
                      </Button>
                      <Button size="sm" variant="outline" disabled={loading} onClick={() => generateDraft(rec)}>
                        Generate draft
                      </Button>
                    </div>
                  ) : null}

                  <FeedbackForm
                    recommendationId={String(rec.id)}
                    disabled={loading}
                    onSubmit={(status, explanation) =>
                      handleAction({
                        action: "submitFeedback",
                        recommendationId: rec.id,
                        status,
                        userExplanation: explanation || undefined,
                      })
                    }
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {mode === "drafts" && (
        <div className="space-y-4">
          {allDrafts.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">No drafts yet.</p>
          ) : null}
          {allDrafts.map((draft) => (
            <Card key={String(draft.id)}>
              <CardContent className="py-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="muted">{String(draft.draftType ?? "DRAFT")}</Badge>
                  {draft.recommendationId ? (
                    <span className="text-xs text-muted-foreground">Rec: {String(draft.recommendationId)}</span>
                  ) : null}
                  {draft.safe === false ? <Badge variant="warning">Safety warnings</Badge> : null}
                  {draft.safe === true ? <Badge variant="muted">Passed safety check</Badge> : null}
                </div>
                {draft.subject ? (
                  <p className="text-sm font-medium">Subject: {String(draft.subject)}</p>
                ) : null}
                <div className="rounded-md bg-muted/30 p-3">
                  <p className="text-sm whitespace-pre-wrap">{String(draft.body ?? "")}</p>
                </div>
                <SafetyWarnings warnings={draft.warnings as string[] | undefined} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {mode === "history" && (
        <div className="space-y-4">
          {runs.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">No analysis history yet.</p>
          ) : null}
          {runs.map((run) => (
            <Card key={String(run.id)}>
              <CardContent className="py-4 flex flex-wrap justify-between items-center gap-2">
                <div>
                  <p className="font-medium">{String(run.reviewType ?? "Analysis run")}</p>
                  {run.summary ? (
                    <p className="text-sm text-muted-foreground">{String(run.summary)}</p>
                  ) : null}
                  {run.createdAt ? (
                    <p className="text-xs text-muted-foreground">
                      {new Date(String(run.createdAt)).toLocaleString()}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground font-mono">{String(run.id)}</p>
                </div>
                <div className="flex gap-2 items-center">
                  <Badge variant="muted">{String(run.status ?? "COMPLETED")}</Badge>
                  <Badge variant="muted">
                    {String(((run.findings as unknown[]) ?? []).length)} findings
                  </Badge>
                  <Badge variant="muted">
                    {String(((run.recommendations as unknown[]) ?? []).length)} recs
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedRunId(String(run.id));
                      window.location.href = "/crm/assistant/findings";
                    }}
                  >
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader><CardTitle>Submit feedback</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <Input
                label="Recommendation ID"
                value={selectedRecommendationId}
                onChange={(e) => setSelectedRecommendationId(e.target.value)}
                placeholder="Recommendation UUID"
              />
              <Input
                label="Status"
                value={feedbackStatus}
                onChange={(e) => setFeedbackStatus(e.target.value)}
                hint={`Options: ${FEEDBACK_STATUSES.join(", ")}`}
              />
              <Input
                label="Explanation"
                value={feedbackExplanation}
                onChange={(e) => setFeedbackExplanation(e.target.value)}
                placeholder={feedbackStatus === "REJECTED" ? "Required for rejection" : "Optional notes"}
              />
              <Button
                onClick={() =>
                  handleAction({
                    action: "submitFeedback",
                    recommendationId: selectedRecommendationId,
                    status: feedbackStatus,
                    userExplanation: feedbackExplanation || undefined,
                  })
                }
                disabled={!selectedRecommendationId.trim() || (feedbackStatus === "REJECTED" && !feedbackExplanation.trim())}
              >
                Submit feedback
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
