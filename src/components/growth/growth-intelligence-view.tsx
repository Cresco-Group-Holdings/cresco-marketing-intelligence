"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";

type Mode = "overview" | "insights" | "recommendations" | "experiments";

const nav = [
  ["Overview", "/growth"],
  ["Insights", "/growth/insights"],
  ["Recommendations", "/growth/recommendations"],
  ["Experiments", "/growth/experiments"],
] as const;

const feedbackOptions = [
  "ACCEPTED",
  "DISMISSED",
  "PLANNED",
  "IMPLEMENTED",
  "SUCCESSFUL",
  "UNSUCCESSFUL",
  "INCONCLUSIVE",
] as const;

type Summary = {
  sufficientInsights: number;
  insufficientInsights: number;
  activeRecommendations: number;
  activeExperiments: number;
};

type Insight = {
  id: string;
  insightType: string;
  title: string;
  summary: string;
  dataStatus: string;
  confidenceLevel: string;
  supportingContentIds: string[];
  generatedAt: string;
};

type Recommendation = {
  id: string;
  title: string;
  description: string;
  recommendedAction?: string | null;
  priority: number;
  status: string;
  insightType?: string | null;
  explanation?: string | null;
  explanationSource?: string | null;
  latestFeedbackStatus?: string | null;
};

type Experiment = {
  id: string;
  title: string;
  hypothesis: string;
  status: string;
  measurementPlan?: string | null;
};

export function GrowthIntelligenceView({ mode }: { mode: Mode }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const [days, setDays] = useState("30");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [explainState, setExplainState] = useState<Record<string, "loading" | "success" | "fallback" | "error">>({});
  const [calendarTarget, setCalendarTarget] = useState<string | null>(null);
  const [socialAccountId, setSocialAccountId] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [timezone, setTimezone] = useState("UTC");

  const query = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - Number(days) * 86_400_000);
    return new URLSearchParams({
      organisationId: organisationId ?? "",
      from: from.toISOString(),
      to: to.toISOString(),
    }).toString();
  }, [organisationId, days]);

  const load = useCallback(async () => {
    if (!brandId || !organisationId) return;
    setError(null);
    try {
      if (mode === "overview") {
        const res = await apiFetch<Summary>(`/api/brands/${brandId}/growth?organisationId=${organisationId}`);
        setSummary(res);
      }
      if (mode === "insights" || mode === "overview") {
        const res = await apiFetch<Insight[]>(
          `/api/brands/${brandId}/growth/insights?organisationId=${organisationId}`,
        );
        setInsights(res);
      }
      if (mode === "recommendations" || mode === "overview") {
        const res = await apiFetch<Recommendation[]>(
          `/api/brands/${brandId}/growth/recommendations?organisationId=${organisationId}`,
        );
        setRecommendations(res);
      }
      if (mode === "experiments") {
        const res = await apiFetch<Experiment[]>(
          `/api/brands/${brandId}/growth/experiments?organisationId=${organisationId}`,
        );
        setExperiments(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load growth data.");
    }
  }, [brandId, organisationId, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAnalysis = async () => {
    if (!brandId || !organisationId) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const result = await apiFetch<{ sufficientInsights: number; recommendationCount: number }>(
        `/api/brands/${brandId}/growth?${query}`,
        { method: "POST" },
      );
      setMessage(
        `Analysis complete: ${result.sufficientInsights} evidence-backed insights, ${result.recommendationCount} recommendations.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const sendFeedback = async (recommendationId: string, feedbackStatus: string) => {
    if (!brandId || !organisationId) return;
    try {
      await apiFetch(
        `/api/brands/${brandId}/growth/recommendations/${recommendationId}?organisationId=${organisationId}`,
        {
          method: "POST",
          body: JSON.stringify({ feedbackStatus }),
        },
      );
      setMessage(`Marked recommendation as ${feedbackStatus}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record feedback.");
    }
  };

  const explainRecommendation = async (recommendationId: string) => {
    if (!brandId || !organisationId) return;
    setExplainState((current) => ({ ...current, [recommendationId]: "loading" }));
    setError(null);
    try {
      const result = await apiFetch<{ explanationSource?: string }>(
        `/api/brands/${brandId}/growth/recommendations/${recommendationId}?organisationId=${organisationId}&action=explain`,
        { method: "POST" },
      );
      setExplainState((current) => ({
        ...current,
        [recommendationId]: result.explanationSource === "DETERMINISTIC_FALLBACK" ? "fallback" : "success",
      }));
      setMessage(
        result.explanationSource === "DETERMINISTIC_FALLBACK"
          ? "AI provider unavailable. Showing deterministic explanation."
          : "AI explanation generated from validated evidence.",
      );
      await load();
    } catch (err) {
      setExplainState((current) => ({ ...current, [recommendationId]: "error" }));
      setError(err instanceof Error ? err.message : "Failed to generate AI explanation.");
    }
  };

  const explainInsight = async (insightId: string) => {
    if (!brandId || !organisationId) return;
    setExplainState((current) => ({ ...current, [insightId]: "loading" }));
    setError(null);
    try {
      const result = await apiFetch<{ explanation: { explanationSource?: string } }>(
        `/api/brands/${brandId}/growth/insights/${insightId}?organisationId=${organisationId}&action=explain`,
        { method: "POST" },
      );
      setExplainState((current) => ({
        ...current,
        [insightId]:
          result.explanation.explanationSource === "DETERMINISTIC_FALLBACK" ? "fallback" : "success",
      }));
      setMessage(
        result.explanation.explanationSource === "DETERMINISTIC_FALLBACK"
          ? "AI provider unavailable. Showing deterministic explanation."
          : "AI explanation generated from validated evidence.",
      );
      await load();
    } catch (err) {
      setExplainState((current) => ({ ...current, [insightId]: "error" }));
      setError(err instanceof Error ? err.message : "Failed to generate AI explanation.");
    }
  };

  const createDraft = async (recommendationId: string, draftType: string) => {
    if (!brandId || !organisationId) return;
    try {
      const body: Record<string, string> = { draftType };
      if (draftType === "CALENDAR_PLACEHOLDER") {
        if (!socialAccountId || !scheduledFor || !timezone) {
          setError("Calendar placeholder requires account, schedule time, and timezone.");
          return;
        }
        body.socialAccountId = socialAccountId;
        body.scheduledFor = new Date(scheduledFor).toISOString();
        body.timezone = timezone;
      }
      const result = await apiFetch<{ contentItemId?: string; experimentId?: string; scheduleId?: string }>(
        `/api/brands/${brandId}/growth/recommendations/${recommendationId}?organisationId=${organisationId}&action=draft`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      setCalendarTarget(null);
      setMessage(
        draftType === "EXPERIMENT"
          ? `Experiment created: ${result.experimentId}`
          : draftType === "CALENDAR_PLACEHOLDER"
            ? `Calendar placeholder created: ${result.scheduleId}`
            : `Draft created: ${result.contentItemId}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create draft.");
    }
  };

  if (!brandId) {
    return <p className="text-muted-foreground">Select a brand to view growth intelligence.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organic Growth Intelligence"
        description="Evidence-backed recommendations from real social performance data."
      />

      <nav className="flex flex-wrap gap-2">
        {nav.map(([label, href]) => (
          <Link key={href} href={href}>
            <Button variant={href.endsWith(mode === "overview" ? "/growth" : `/growth/${mode}`) ? "primary" : "outline"} size="sm">
              {label}
            </Button>
          </Link>
        ))}
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>Analysis controls</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            Period (days)
            <input
              className="ml-2 rounded border px-2 py-1"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              type="number"
              min={7}
              max={90}
            />
          </label>
          <Button onClick={() => void runAnalysis()} disabled={loading}>
            {loading ? "Analysing…" : "Run deterministic analysis"}
          </Button>
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {mode === "overview" && summary ? (
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader><CardTitle className="text-base">Evidence-backed</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{summary.sufficientInsights}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Awaiting data</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{summary.insufficientInsights}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Active recommendations</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{summary.activeRecommendations}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Active experiments</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{summary.activeExperiments}</CardContent></Card>
        </div>
      ) : null}

      {(mode === "overview" || mode === "insights") && (
        <Card>
          <CardHeader><CardTitle>Insights</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {insights.length === 0 ? (
              <p className="text-muted-foreground">No insights yet. Run analysis to generate evidence-backed findings.</p>
            ) : (
              insights.map((insight) => (
                <div key={insight.id} className="rounded border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{insight.title}</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">{insight.insightType}</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">{insight.confidenceLevel}</span>
                    <span className={`rounded px-2 py-0.5 text-xs ${insight.dataStatus === "SUFFICIENT" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                      {insight.dataStatus === "INSUFFICIENT" ? "Not enough data yet" : insight.dataStatus}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{insight.summary}</p>
                  {insight.dataStatus === "SUFFICIENT" ? (
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={explainState[insight.id] === "loading"}
                        onClick={() => void explainInsight(insight.id)}
                      >
                        {explainState[insight.id] === "loading"
                          ? "Explaining…"
                          : explainState[insight.id] === "fallback"
                            ? "Deterministic explanation shown"
                            : explainState[insight.id] === "success"
                              ? "Explanation ready"
                              : explainState[insight.id] === "error"
                                ? "Retry explain with AI"
                                : "Explain with AI"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {(mode === "overview" || mode === "recommendations") && (
        <Card>
          <CardHeader><CardTitle>Recommendations</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {recommendations.length === 0 ? (
              <p className="text-muted-foreground">No active recommendations.</p>
            ) : (
              recommendations.map((rec) => (
                <div key={rec.id} className="rounded border p-3">
                  <p className="font-medium">{rec.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{rec.description}</p>
                  {rec.recommendedAction ? (
                    <p className="mt-2 text-sm"><strong>Action:</strong> {rec.recommendedAction}</p>
                  ) : null}
                  {rec.explanation ? (
                    <p className="mt-2 text-sm text-muted-foreground">{rec.explanation}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={explainState[rec.id] === "loading"}
                      onClick={() => void explainRecommendation(rec.id)}
                    >
                      {explainState[rec.id] === "loading"
                        ? "Explaining…"
                        : explainState[rec.id] === "fallback"
                          ? "Deterministic explanation shown"
                          : explainState[rec.id] === "success"
                            ? "Explanation ready"
                            : explainState[rec.id] === "error"
                              ? "Retry explain with AI"
                              : "Explain with AI"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void createDraft(rec.id, "CONTENT_IDEA")}>
                      Create idea
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void createDraft(rec.id, "STUDIO_BRIEF")}>
                      Studio brief
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void createDraft(rec.id, "EXPERIMENT")}>
                      Experiment
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCalendarTarget(calendarTarget === rec.id ? null : rec.id)}
                    >
                      Calendar placeholder
                    </Button>
                    {feedbackOptions.map((status) => (
                      <Button key={status} size="sm" variant="ghost" onClick={() => void sendFeedback(rec.id, status)}>
                        {status}
                      </Button>
                    ))}
                  </div>
                  {calendarTarget === rec.id ? (
                    <div className="mt-3 grid gap-2 rounded border bg-muted/30 p-3 md:grid-cols-3">
                      <label className="text-sm">
                        Social account ID
                        <input
                          className="mt-1 w-full rounded border px-2 py-1"
                          value={socialAccountId}
                          onChange={(event) => setSocialAccountId(event.target.value)}
                        />
                      </label>
                      <label className="text-sm">
                        Scheduled for
                        <input
                          className="mt-1 w-full rounded border px-2 py-1"
                          type="datetime-local"
                          value={scheduledFor}
                          onChange={(event) => setScheduledFor(event.target.value)}
                        />
                      </label>
                      <label className="text-sm">
                        Timezone
                        <input
                          className="mt-1 w-full rounded border px-2 py-1"
                          value={timezone}
                          onChange={(event) => setTimezone(event.target.value)}
                        />
                      </label>
                      <div className="md:col-span-3">
                        <Button size="sm" onClick={() => void createDraft(rec.id, "CALENDAR_PLACEHOLDER")}>
                          Create calendar placeholder
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {mode === "experiments" && (
        <Card>
          <CardHeader><CardTitle>Experiments</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {experiments.length === 0 ? (
              <p className="text-muted-foreground">No experiments yet. Convert a recommendation to start one.</p>
            ) : (
              experiments.map((exp) => (
                <div key={exp.id} className="rounded border p-3">
                  <p className="font-medium">{exp.title}</p>
                  <p className="text-sm text-muted-foreground">{exp.hypothesis}</p>
                  <span className="mt-2 inline-block rounded bg-muted px-2 py-0.5 text-xs">{exp.status}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
