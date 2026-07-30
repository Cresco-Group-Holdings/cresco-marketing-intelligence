"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";
import { ANALYST_DISCLAIMER, BRIEF_TYPES, SUGGESTED_QUESTIONS } from "@/lib/analyst/constants";
import type { MarketingAnalystOutput } from "@/lib/ai/analyst-output-schemas";

export type AnalystMode = "ask" | "history" | "saved" | "recommendations";

const nav: Array<{ label: string; href: string; mode: AnalystMode }> = [
  { label: "Ask", href: "/analyst", mode: "ask" },
  { label: "History", href: "/analyst/history", mode: "history" },
  { label: "Saved", href: "/analyst/saved", mode: "saved" },
  { label: "Recommendations", href: "/analyst/recommendations", mode: "recommendations" },
];

function OutputView({ output, evidence }: { output: MarketingAnalystOutput; evidence?: unknown }) {
  const [showEvidence, setShowEvidence] = useState(false);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
        <CardContent className="text-sm">{output.summary}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Key findings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {output.keyFindings.map((finding, index) => (
            <div key={index} className="rounded border p-3 text-sm">
              <div className="mb-1 flex gap-2">
                <Badge variant="muted">{finding.claimType}</Badge>
                <Badge variant="muted">{finding.confidence}</Badge>
              </div>
              <p>{finding.statement}</p>
              <p className="mt-1 text-xs text-muted-foreground">Evidence: {finding.evidenceKeys.join(", ")}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      {output.recommendedActions.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Recommended actions</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {output.recommendedActions.map((action, index) => (
              <div key={index} className="rounded border p-3">
                <p className="font-medium">{action.title}</p>
                <p className="text-muted-foreground">{action.description}</p>
                <p className="text-xs">Type: {action.actionType} · Priority: {action.priority}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      {output.limitations.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Limitations</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            {output.limitations.map((item, index) => <p key={index}>{item}</p>)}
          </CardContent>
        </Card>
      ) : null}
      <Button variant="outline" size="sm" onClick={() => setShowEvidence((v) => !v)}>
        {showEvidence ? "Hide" : "Show"} evidence package
      </Button>
      {showEvidence && evidence ? (
        <pre className="max-h-96 overflow-auto rounded bg-slate-50 p-4 text-xs">{JSON.stringify(evidence, null, 2)}</pre>
      ) : null}
    </div>
  );
}

export function AnalystView({ mode }: { mode: AnalystMode }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const [question, setQuestion] = useState("");
  const [days, setDays] = useState("28");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ output: MarketingAnalystOutput; evidence?: unknown; runId?: string } | null>(null);
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
  const [recommendations, setRecommendations] = useState<Array<Record<string, unknown>>>([]);

  const loadHistory = useCallback(async () => {
    if (!brandId || !organisationId) return;
    const saved = mode === "saved";
    const data = await apiFetch(
      `/api/brands/${brandId}/analyst?organisationId=${organisationId}${saved ? "&saved=true" : ""}`,
      { organisationId },
    );
    if (data && typeof data === "object" && "runs" in data) {
      setRuns((data as { runs: Array<Record<string, unknown>> }).runs);
    }
  }, [brandId, organisationId, mode]);

  const loadRecommendations = useCallback(async () => {
    if (!brandId || !organisationId) return;
    const data = await apiFetch(
      `/api/brands/${brandId}/analyst/recommendations?organisationId=${organisationId}`,
      { organisationId },
    );
    if (data && typeof data === "object" && "recommendations" in data) {
      setRecommendations((data as { recommendations: Array<Record<string, unknown>> }).recommendations);
    }
  }, [brandId, organisationId]);

  useEffect(() => {
    if (mode === "history" || mode === "saved") void loadHistory().catch(() => undefined);
    if (mode === "recommendations") void loadRecommendations().catch(() => undefined);
  }, [mode, loadHistory, loadRecommendations]);

  async function askQuestion(q?: string) {
    if (!brandId || !organisationId) return;
    const text = (q ?? question).trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/api/brands/${brandId}/analyst?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({ question: text, dateRangeDays: Number(days) }),
      });
      const analysis = data && typeof data === "object" && "analysis" in data
        ? (data as { analysis: { output: MarketingAnalystOutput; evidence: unknown; run: { id: string } } }).analysis
        : null;
      if (analysis) {
        setResult({ output: analysis.output, evidence: analysis.evidence, runId: analysis.run?.id });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  async function generateBrief(briefType: keyof typeof BRIEF_TYPES) {
    if (!brandId || !organisationId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/api/brands/${brandId}/analyst?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({ briefType }),
      });
      const brief = data && typeof data === "object" && "brief" in data
        ? (data as { brief: { output: MarketingAnalystOutput; evidence: unknown; run: { id: string } } }).brief
        : null;
      if (brief) {
        setResult({ output: brief.output, evidence: brief.evidence, runId: brief.run?.id });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Brief generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveAnalysis() {
    if (!brandId || !organisationId || !result?.runId) return;
    await apiFetch(`/api/brands/${brandId}/analyst/runs/${result.runId}?organisationId=${organisationId}`, {
      method: "PATCH",
      organisationId,
    });
  }

  async function dismissRecommendation(id: string) {
    if (!brandId || !organisationId) return;
    await apiFetch(
      `/api/brands/${brandId}/analyst/recommendations/${id}?organisationId=${organisationId}&action=dismiss`,
      { method: "POST", organisationId },
    );
    await loadRecommendations();
  }

  async function createAction(id: string) {
    if (!brandId || !organisationId) return;
    await apiFetch(
      `/api/brands/${brandId}/analyst/recommendations/${id}?organisationId=${organisationId}&action=create`,
      { method: "POST", organisationId },
    );
    await loadRecommendations();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Marketing Analyst"
        description="Evidence-grounded analysis of real marketing data with traceable claims."
        breadcrumbs={[{ label: "Analyst", href: "/analyst" }, { label: mode }]}
      />
      <nav className="flex flex-wrap gap-2">
        {nav.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button variant={item.mode === mode ? "primary" : "outline"} size="sm">{item.label}</Button>
          </Link>
        ))}
      </nav>
      <p className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{ANALYST_DISCLAIMER}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {mode === "ask" ? (
        <>
          <div className="flex flex-wrap gap-3">
            <select className="rounded-md border px-3 py-2 text-sm" value={days} onChange={(e) => setDays(e.target.value)}>
              {["7", "14", "28", "90"].map((v) => <option key={v} value={v}>Last {v} days</option>)}
            </select>
            {Object.entries(BRIEF_TYPES).map(([key, config]) => (
              <Button key={key} size="sm" variant="outline" disabled={loading} onClick={() => void generateBrief(key as keyof typeof BRIEF_TYPES)}>
                {config.label}
              </Button>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle>Ask a question</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className="min-h-24 w-full rounded-md border p-3 text-sm"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What changed in marketing performance this month?"
              />
              <Button disabled={loading} onClick={() => void askQuestion()}>{loading ? "Analysing…" : "Analyse"}</Button>
            </CardContent>
          </Card>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <Button key={q} size="sm" variant="outline" onClick={() => void askQuestion(q)}>{q}</Button>
            ))}
          </div>
          {result ? (
            <>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void saveAnalysis()}>Save analysis</Button>
              </div>
              <OutputView output={result.output} evidence={result.evidence} />
            </>
          ) : null}
        </>
      ) : null}

      {(mode === "history" || mode === "saved") ? (
        <Card>
          <CardHeader><CardTitle>{mode === "saved" ? "Saved analyses" : "Analysis history"}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {runs.length === 0 ? <p className="text-muted-foreground">No analyses yet.</p> : runs.map((run) => (
              <div key={String(run.id)} className="rounded border p-3">
                <p className="font-medium">{String(run.question ?? run.briefType ?? "Analysis")}</p>
                <p className="text-xs text-muted-foreground">{String(run.createdAt)} · {String(run.outputSource ?? "—")}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {mode === "recommendations" ? (
        <Card>
          <CardHeader><CardTitle>Open recommendations</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {recommendations.length === 0 ? <p className="text-muted-foreground">No open recommendations.</p> : recommendations.map((rec) => (
              <div key={String(rec.id)} className="rounded border p-3">
                <p className="font-medium">{String(rec.title)}</p>
                <p className="text-muted-foreground">{String(rec.description)}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void createAction(String(rec.id))}>Create task</Button>
                  <Button size="sm" variant="outline" onClick={() => void dismissRecommendation(String(rec.id))}>Dismiss</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
