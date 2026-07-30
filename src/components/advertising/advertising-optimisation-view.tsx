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
import { OPTIMISATION_DISCLAIMER, REVIEW_TYPES } from "@/lib/advertising-optimisation/constants";

export type OptimisationViewMode = "overview" | "findings" | "recommendations" | "history" | "detail";

function OptimisationNav({ active, recommendationId }: { active: OptimisationViewMode; recommendationId?: string }) {
  const tabs: Array<{ mode: OptimisationViewMode; label: string; href: string }> = [
    { mode: "overview", label: "Overview", href: "/advertising/optimisation" },
    { mode: "findings", label: "Findings", href: "/advertising/optimisation/findings" },
    { mode: "recommendations", label: "Recommendations", href: "/advertising/optimisation/recommendations" },
    { mode: "history", label: "History", href: "/advertising/optimisation/history" },
  ];
  if (recommendationId) {
    tabs.push({
      mode: "detail",
      label: "Detail",
      href: `/advertising/optimisation/${recommendationId}`,
    });
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

const CONFIDENCE_VARIANT: Record<string, "default" | "muted" | "warning"> = {
  HIGH: "default",
  MEDIUM: "warning",
  LOW: "muted",
};

export function AdvertisingOptimisationView({
  mode,
  recommendationId,
}: {
  mode: OptimisationViewMode;
  recommendationId?: string;
}) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const base = brandId ? `/api/brands/${brandId}/advertising/optimisation` : null;

  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
  const [recommendation, setRecommendation] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reviewType, setReviewType] = useState("ON_DEMAND_CAMPAIGN");

  const loadRuns = useCallback(async () => {
    if (!base || !organisationId) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ runs: Array<Record<string, unknown>> }>(`${base}?organisationId=${organisationId}`);
      setRuns(res.runs);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load optimisation runs.");
    } finally {
      setLoading(false);
    }
  }, [base, organisationId]);

  const loadRecommendation = useCallback(async () => {
    if (!base || !organisationId || !recommendationId) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ recommendation: Record<string, unknown> }>(
        `${base}/${recommendationId}?organisationId=${organisationId}`,
      );
      setRecommendation(res.recommendation);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load recommendation.");
    } finally {
      setLoading(false);
    }
  }, [base, organisationId, recommendationId]);

  useEffect(() => {
    if (mode === "detail") loadRecommendation();
    else loadRuns();
  }, [mode, loadRuns, loadRecommendation]);

  async function startRun() {
    if (!base || !organisationId) return;
    setLoading(true);
    setMessage(null);
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      await apiFetch(`${base}?organisationId=${organisationId}`, {
        method: "POST",
        body: JSON.stringify({
          action: "startRun",
          reviewType,
          dateRangeStart: weekAgo.toISOString(),
          dateRangeEnd: now.toISOString(),
          analysis: {
            currency: "USD",
            attributionModel: "last_click",
            minimumVolume: 1000,
            metrics: { impressions: 5000, clicks: 120, spend: 800, conversions: 8, revenue: 2400 },
            dataQuality: { freshnessHours: 12, hasTracking: true },
          },
        }),
      });
      setMessage("Optimisation run completed.");
      await loadRuns();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Run failed.");
    } finally {
      setLoading(false);
    }
  }

  const latestRun = runs[0];
  const allFindings = runs.flatMap((r) => (r.findings as Array<Record<string, unknown>>) ?? []);
  const allRecommendations = runs.flatMap(
    (r) => (r.recommendations as Array<Record<string, unknown>>) ?? [],
  );

  const detailProposals = (recommendation?.actionProposals as Array<Record<string, unknown>>) ?? [];
  const detailEvidence = (recommendation?.run as Record<string, unknown>)?.evidence as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Advertising Optimisation"
        description="Evidence-grounded analysis and controlled optimisation proposals. No autonomous campaign or budget changes."
      />
      <OptimisationNav active={mode} recommendationId={recommendationId} />
      <p className="text-sm text-muted-foreground">{OPTIMISATION_DISCLAIMER}</p>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {(mode === "overview" || mode === "history") && (
        <>
          {mode === "overview" && (
            <Card>
              <CardHeader>
                <CardTitle>Start optimisation review</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="text-sm font-medium">Review type</label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={reviewType}
                  onChange={(e) => setReviewType(e.target.value)}
                >
                  {REVIEW_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <Button disabled={loading} onClick={startRun}>
                  Run {reviewType.replace(/_/g, " ").toLowerCase()} review
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{mode === "history" ? "Run history" : "Latest run"}</CardTitle>
            </CardHeader>
            <CardContent>
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No optimisation runs yet.</p>
              ) : (
                <ul className="space-y-3">
                  {(mode === "history" ? runs : runs.slice(0, 1)).map((run) => (
                    <li key={String(run.id)} className="border-b pb-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{String(run.reviewType)}</span>
                        <Badge variant="muted">{String(run.status)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{String(run.summary ?? "")}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {String(run.dateRangeStart)} → {String(run.dateRangeEnd)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {mode === "findings" && (
        <Card>
          <CardHeader>
            <CardTitle>Findings</CardTitle>
          </CardHeader>
          <CardContent>
            {allFindings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No findings yet.</p>
            ) : (
              <ul className="space-y-3">
                {allFindings.map((f) => (
                  <li key={String(f.id)} className="border-b pb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={f.suppressed ? "muted" : "warning"}>{String(f.findingType)}</Badge>
                      <span className="font-medium text-sm">{String(f.title)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{String(f.description)}</p>
                    {f.suppressed ? (
                      <p className="text-xs text-muted-foreground mt-1">Suppressed: {String(f.suppressionReason)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "recommendations" && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            {allRecommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recommendations yet.</p>
            ) : (
              <ul className="space-y-3">
                {allRecommendations.map((rec) => (
                  <li key={String(rec.id)} className="border-b pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={CONFIDENCE_VARIANT[String(rec.confidenceLevel)] ?? "muted"}>
                          {String(rec.confidenceLevel)}
                        </Badge>
                        <span className="font-medium text-sm">{String(rec.title)}</span>
                      </div>
                      {rec.requiresApproval ? <Badge variant="warning">Approval required</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{String(rec.description)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Budget impact: {String(rec.budgetImpact)}</p>
                    <ButtonLink href={`/advertising/optimisation/${String(rec.id)}`} size="sm" className="mt-2">
                      View detail
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "detail" && recommendation && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recommendation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{String(recommendation.title)}</p>
              <p className="text-muted-foreground">{String(recommendation.description)}</p>
              <p>Confidence: {String(recommendation.confidenceLevel)}</p>
              <p>Evidence strength: {String(recommendation.evidenceStrength)}</p>
              <p>Sample size: {String(recommendation.sampleSizeState)}</p>
              <p>Data quality: {String(recommendation.dataQualityState)}</p>
              <p>Risk: {String(recommendation.risk)}</p>
              <p>Budget impact: {String(recommendation.budgetImpact)}</p>
              <p>Measurement plan: {String(recommendation.measurementPlan)}</p>
              {recommendation.requiresApproval ? <Badge variant="warning">Human approval required</Badge> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {detailEvidence ? (
                <ul className="space-y-1">
                  <li>Currency: {String(detailEvidence.currency)}</li>
                  <li>Attribution: {String(detailEvidence.attributionModel)}</li>
                  <li>Minimum volume met: {String(detailEvidence.minimumVolumeMet)}</li>
                  <li>Freshness: {String(detailEvidence.freshnessHours)}h</li>
                </ul>
              ) : (
                <p className="text-muted-foreground">No evidence package.</p>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Action proposals</CardTitle>
            </CardHeader>
            <CardContent>
              {detailProposals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No action proposals.</p>
              ) : (
                <ul className="space-y-3">
                  {detailProposals.map((p) => (
                    <li key={String(p.id)} className="border-b pb-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{String(p.actionClass)}</span>
                        <Badge variant={p.status === "BLOCKED" ? "warning" : "muted"}>{String(p.status)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{String(p.description)}</p>
                      {p.status === "PENDING" && (
                        <Button
                          size="sm"
                          className="mt-2"
                          disabled={loading}
                          onClick={async () => {
                            if (!base || !organisationId || !recommendationId) return;
                            setLoading(true);
                            try {
                              await apiFetch(`${base}/${recommendationId}?organisationId=${organisationId}`, {
                                method: "POST",
                                body: JSON.stringify({ action: "approveAction", actionProposalId: p.id }),
                              });
                              setMessage("Action approved.");
                              await loadRecommendation();
                            } catch (e) {
                              setMessage(e instanceof Error ? e.message : "Approval failed.");
                            } finally {
                              setLoading(false);
                            }
                          }}
                        >
                          Approve action
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "overview" && latestRun && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Findings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{((latestRun.findings as unknown[]) ?? []).length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{((latestRun.recommendations as unknown[]) ?? []).length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Review type</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{String(latestRun.reviewType)}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
