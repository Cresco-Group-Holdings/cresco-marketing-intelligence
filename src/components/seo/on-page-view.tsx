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

export type OnPageViewMode = "list" | "detail" | "history" | "compare";

type Audit = {
  id: string;
  url?: string;
  pageTitle?: string;
  status: string;
  sourceType: string;
  staleSnapshotWarning?: boolean;
  staleSnapshotNote?: string;
  targetKeyword?: { displayKeyword: string };
  crawlPage?: { normalisedUrl: string };
  findings?: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    priority: string;
    status: string;
    ruleId?: string;
  }>;
  recommendations?: Array<{
    id: string;
    title: string;
    type: string;
    priority: string;
    status: string;
  }>;
  versions?: Array<Record<string, unknown>>;
  comparisons?: Array<Record<string, unknown>>;
  _count?: { findings: number; recommendations: number; versions: number };
};

export function OnPageView({ mode, pageId }: { mode: OnPageViewMode; pageId?: string }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;

  const [audits, setAudits] = useState<Audit[]>([]);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [comparisons, setComparisons] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [crawlPageId, setCrawlPageId] = useState("");
  const [longFormId, setLongFormId] = useState("");
  const [keywordId, setKeywordId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const apiBase = useMemo(() => (brandId ? `/api/brands/${brandId}/seo/on-page` : null), [brandId]);

  const loadAudits = useCallback(async () => {
    if (!apiBase || !organisationId) return;
    const data = await apiFetch<{ items: Audit[] }>(`${apiBase}?organisationId=${organisationId}`, { organisationId });
    setAudits(data.items);
  }, [apiBase, organisationId]);

  const loadAudit = useCallback(async () => {
    if (!apiBase || !organisationId || !pageId) return;
    const data = await apiFetch<{ audit: Audit }>(`${apiBase}/${pageId}?organisationId=${organisationId}`, { organisationId });
    setAudit(data.audit);
  }, [apiBase, organisationId, pageId]);

  useEffect(() => {
    void (async () => {
      try {
        if (!apiBase || !organisationId) return;
        if (mode === "list") await loadAudits();
        if (mode === "detail" && pageId) await loadAudit();
        if (mode === "history" && pageId) {
          const data = await apiFetch<{ versions: Array<Record<string, unknown>> }>(
            `${apiBase}/${pageId}/history?organisationId=${organisationId}`,
            { organisationId },
          );
          setHistory(data.versions);
        }
        if (mode === "compare" && pageId) {
          const data = await apiFetch<{ comparisons: Array<Record<string, unknown>> }>(
            `${apiBase}/${pageId}/compare?organisationId=${organisationId}`,
            { organisationId },
          );
          setComparisons(data.comparisons);
        }
      } catch {
        setMessage("Failed to load on-page SEO data.");
      }
    })();
  }, [mode, pageId, loadAudits, loadAudit, apiBase, organisationId]);

  async function createAudit() {
    if (!apiBase || !organisationId) return;
    const data = await apiFetch<{ audit: Audit }>(`${apiBase}?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({
        sourceType: crawlPageId ? "CRAWL_SNAPSHOT" : longFormId ? "LONG_FORM_DRAFT" : "MANUAL_URL",
        crawlPageId: crawlPageId || undefined,
        longFormDocumentId: longFormId || undefined,
        targetKeywordId: keywordId || undefined,
      }),
    });
    window.location.href = `/seo/on-page/${data.audit.id}`;
  }

  async function runAudit() {
    if (!apiBase || !organisationId || !pageId) return;
    await apiFetch(`${apiBase}/${pageId}?organisationId=${organisationId}&action=run-audit`, {
      method: "POST",
      organisationId,
      body: "{}",
    });
    setMessage("Audit completed. No production changes made.");
    await loadAudit();
  }

  async function runComparison() {
    if (!apiBase || !organisationId || !pageId) return;
    await apiFetch(`${apiBase}/${pageId}/compare?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ comparisonType: "PREVIOUS_AUDIT" }),
    });
    setMessage("Comparison created. Rankings improvements are not guaranteed.");
    const data = await apiFetch<{ comparisons: Array<Record<string, unknown>> }>(
      `${apiBase}/${pageId}/compare?organisationId=${organisationId}`,
      { organisationId },
    );
    setComparisons(data.comparisons);
  }

  async function overrideFinding(findingId: string) {
    if (!apiBase || !organisationId || !pageId || !overrideReason.trim()) return;
    await apiFetch(`${apiBase}/${pageId}?organisationId=${organisationId}&action=override`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ findingId, reason: overrideReason.trim() }),
    });
    setOverrideReason("");
    setMessage("Finding overridden.");
    await loadAudit();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="On-page SEO"
        description="Evidence-based on-page analysis and recommendations. Does not modify production pages."
      />

      <nav className="flex flex-wrap gap-2">
        <Link href="/seo/on-page"><Button variant={mode === "list" ? "primary" : "outline"} size="sm">Audits</Button></Link>
        {pageId ? (
          <>
            <Link href={`/seo/on-page/${pageId}`}><Button variant={mode === "detail" ? "primary" : "outline"} size="sm">Audit</Button></Link>
            <Link href={`/seo/on-page/${pageId}/history`}><Button variant={mode === "history" ? "primary" : "outline"} size="sm">History</Button></Link>
            <Link href={`/seo/on-page/${pageId}/compare`}><Button variant={mode === "compare" ? "primary" : "outline"} size="sm">Compare</Button></Link>
          </>
        ) : null}
      </nav>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {mode === "list" && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">New audit</CardTitle></CardHeader>
            <CardContent className="grid gap-3 max-w-lg">
              <Input label="Crawl page ID" value={crawlPageId} onChange={(e) => setCrawlPageId(e.target.value)} placeholder="SeoCrawlPage ID" />
              <Input label="Long-form document ID" value={longFormId} onChange={(e) => setLongFormId(e.target.value)} placeholder="Optional draft ID" />
              <Input label="Target keyword ID" value={keywordId} onChange={(e) => setKeywordId(e.target.value)} placeholder="Optional SeoKeyword ID" />
              <Button onClick={() => void createAudit()}>Create audit</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Audits ({audits.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {audits.map((a) => (
                <Link key={a.id} href={`/seo/on-page/${a.id}`} className="flex justify-between rounded border p-3 hover:bg-muted/50 text-sm">
                  <div>
                    <p className="font-medium">{a.pageTitle ?? a.url ?? "Untitled"}</p>
                    <p className="text-muted-foreground">{a.sourceType} · {a._count?.findings ?? 0} findings</p>
                  </div>
                  <Badge>{a.status}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {mode === "detail" && audit && (
        <>
          {audit.staleSnapshotWarning ? (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="pt-4 text-sm text-amber-800">
                Stale snapshot warning: {audit.staleSnapshotNote}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader><CardTitle className="text-base">{audit.pageTitle ?? audit.url ?? "Audit"}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Status: {audit.status} · Source: {audit.sourceType} · Keyword: {audit.targetKeyword?.displayKeyword ?? "—"}</p>
              <Button size="sm" onClick={() => void runAudit()} disabled={audit.status === "RUNNING"}>
                {audit.status === "COMPLETED" ? "Re-run audit" : "Run audit"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Findings ({audit.findings?.length ?? 0})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(audit.findings ?? []).map((f) => (
                <div key={f.id} className="rounded border p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="font-medium">{f.title}</span>
                    <Badge>{f.priority}</Badge>
                  </div>
                  <p className="text-muted-foreground">{f.description}</p>
                  <p className="text-xs">{f.category} · {f.status}</p>
                  {f.status === "OPEN" ? (
                    <div className="flex gap-2 mt-2">
                      <Input label="Override reason" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Why override this finding?" />
                      <Button size="sm" variant="outline" onClick={() => void overrideFinding(f.id)}>Override</Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Recommendations ({audit.recommendations?.length ?? 0})</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(audit.recommendations ?? []).map((r) => (
                <div key={r.id} className="rounded border p-2 flex justify-between">
                  <span>{r.title} ({r.type})</span>
                  <Badge>{r.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {mode === "history" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Audit versions</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {history.map((v) => (
              <div key={String(v.id)} className="rounded border p-2">
                v{String(v.versionNumber)} · {String(v.status)} · {String(v.createdAt)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {mode === "compare" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Before/after comparison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">Comparisons are advisory. Rankings improvements are not guaranteed.</p>
            <Button size="sm" onClick={() => void runComparison()}>Create comparison</Button>
            {comparisons.map((c) => (
              <div key={String(c.id)} className="rounded border p-3">
                <p>{String(c.comparisonType)} · {String(c.createdAt)}</p>
                <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(c.diffSummary, null, 2)}</pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
