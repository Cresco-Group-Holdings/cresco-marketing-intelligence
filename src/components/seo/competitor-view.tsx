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

export type CompetitorViewMode =
  | "list"
  | "detail"
  | "keywords"
  | "content-gaps"
  | "topics"
  | "compare";

type Competitor = {
  id: string;
  name: string;
  competitorType: string;
  status: string;
  notes?: string;
  domains?: Array<{ hostname: string; isPrimary: boolean }>;
  pages?: Array<Record<string, unknown>>;
  keywords?: Array<Record<string, unknown>>;
  topics?: Array<Record<string, unknown>>;
  contentGaps?: Array<Record<string, unknown>>;
  snapshots?: Array<Record<string, unknown>>;
  _count?: { pages: number; keywords: number; contentGaps: number; snapshots: number };
};

const nav: Array<{ label: string; href: string; mode: CompetitorViewMode }> = [
  { label: "Competitors", href: "/seo/competitors", mode: "list" },
  { label: "Keywords", href: "/seo/competitors/keywords", mode: "keywords" },
  { label: "Content gaps", href: "/seo/competitors/content-gaps", mode: "content-gaps" },
  { label: "Topics", href: "/seo/competitors/topics", mode: "topics" },
  { label: "Compare", href: "/seo/competitors/compare", mode: "compare" },
];

const COMPETITOR_TYPES = [
  "DIRECT",
  "INDIRECT",
  "SEARCH_COMPETITOR",
  "CONTENT_COMPETITOR",
  "ASPIRATIONAL",
  "OTHER",
] as const;

export function CompetitorView({
  mode,
  competitorId,
}: {
  mode: CompetitorViewMode;
  competitorId?: string;
}) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [competitor, setCompetitor] = useState<Competitor | null>(null);
  const [keywords, setKeywords] = useState<Array<Record<string, unknown>>>([]);
  const [overlaps, setOverlaps] = useState<Array<Record<string, unknown>>>([]);
  const [overlapSummary, setOverlapSummary] = useState<Record<string, number> | null>(null);
  const [gaps, setGaps] = useState<Array<Record<string, unknown>>>([]);
  const [topics, setTopics] = useState<Array<Record<string, unknown>>>([]);
  const [comparison, setComparison] = useState<Record<string, unknown> | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newType, setNewType] = useState<string>("DIRECT");
  const [newNotes, setNewNotes] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [compareCompetitorId, setCompareCompetitorId] = useState("");
  const [compareBrandPageId, setCompareBrandPageId] = useState("");
  const [compareCompetitorPageId, setCompareCompetitorPageId] = useState("");

  const apiBase = useMemo(
    () => (brandId ? `/api/brands/${brandId}/seo/competitors` : null),
    [brandId],
  );

  const loadCompetitors = useCallback(async () => {
    if (!apiBase || !organisationId) return;
    const data = await apiFetch<{ items: Competitor[] }>(
      `${apiBase}?organisationId=${organisationId}`,
      { organisationId },
    );
    setCompetitors(data.items);
  }, [apiBase, organisationId]);

  const loadCompetitor = useCallback(async () => {
    if (!apiBase || !organisationId || !competitorId) return;
    const data = await apiFetch<{ competitor: Competitor }>(
      `${apiBase}/${competitorId}?organisationId=${organisationId}`,
      { organisationId },
    );
    setCompetitor(data.competitor);
  }, [apiBase, organisationId, competitorId]);

  useEffect(() => {
    void (async () => {
      try {
        if (!apiBase || !organisationId) return;
        if (mode === "list") await loadCompetitors();
        if (mode === "detail" && competitorId) await loadCompetitor();
        if (mode === "keywords") {
          const data = await apiFetch<{ items: Array<Record<string, unknown>> }>(
            `${apiBase}/keywords?organisationId=${organisationId}`,
            { organisationId },
          );
          setKeywords(data.items);
        }
        if (mode === "content-gaps") {
          const data = await apiFetch<{ items: Array<Record<string, unknown>> }>(
            `${apiBase}/content-gaps?organisationId=${organisationId}`,
            { organisationId },
          );
          setGaps(data.items);
        }
        if (mode === "topics") {
          const data = await apiFetch<{ items: Array<Record<string, unknown>> }>(
            `${apiBase}/topics?organisationId=${organisationId}`,
            { organisationId },
          );
          setTopics(data.items);
        }
        if (mode === "compare") await loadCompetitors();
      } catch {
        setMessage("Failed to load competitor data.");
      }
    })();
  }, [mode, competitorId, loadCompetitors, loadCompetitor, apiBase, organisationId]);

  async function addCompetitor() {
    if (!apiBase || !organisationId || !newName.trim() || !newDomain.trim()) return;
    await apiFetch(`${apiBase}?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({
        name: newName.trim(),
        domain: newDomain.trim(),
        competitorType: newType,
        notes: newNotes.trim() || undefined,
      }),
    });
    setNewName("");
    setNewDomain("");
    setNewNotes("");
    setMessage("Competitor added.");
    await loadCompetitors();
  }

  async function archiveCompetitor(id: string) {
    if (!apiBase || !organisationId) return;
    await apiFetch(`${apiBase}/${id}?organisationId=${organisationId}`, {
      method: "PATCH",
      organisationId,
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    setMessage("Competitor archived.");
    await loadCompetitors();
    if (competitorId === id) await loadCompetitor();
  }

  async function startCrawl(id: string) {
    if (!apiBase || !organisationId) return;
    await apiFetch(`${apiBase}/${id}/crawl?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: "{}",
    });
    setMessage("Public crawl started. Results appear when complete.");
    if (competitorId === id) await loadCompetitor();
  }

  async function addKeyword() {
    if (!apiBase || !organisationId || !competitorId || !newKeyword.trim()) return;
    await apiFetch(`${apiBase}/${competitorId}/keywords?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({
        keyword: newKeyword.trim(),
        source: "MANUAL",
        observedAt: new Date().toISOString(),
      }),
    });
    setNewKeyword("");
    setMessage("Keyword observation recorded with source and date.");
    await loadCompetitor();
  }

  async function calculateOverlaps(id: string) {
    if (!apiBase || !organisationId) return;
    const data = await apiFetch<{ overlaps: Array<Record<string, unknown>>; summary: Record<string, number> }>(
      `${apiBase}/overlap?organisationId=${organisationId}&competitorId=${id}`,
      { method: "POST", organisationId, body: "{}" },
    );
    setOverlaps(data.overlaps);
    setOverlapSummary(data.summary);
    setMessage("Overlap analysis updated from traceable sources.");
  }

  async function detectGaps(id: string) {
    if (!apiBase || !organisationId) return;
    const data = await apiFetch<{ gaps: Array<Record<string, unknown>> }>(
      `${apiBase}/content-gaps?organisationId=${organisationId}&competitorId=${id}`,
      { method: "POST", organisationId, body: "{}" },
    );
    setGaps(data.gaps);
    setMessage(`Detected ${data.gaps.length} evidence-based content gaps.`);
  }

  async function runCompare() {
    if (!apiBase || !organisationId || !compareCompetitorId) return;
    const data = await apiFetch<{ comparison: Record<string, unknown> }>(
      `${apiBase}/compare?organisationId=${organisationId}&competitorId=${compareCompetitorId}`,
      {
        method: "POST",
        organisationId,
        body: JSON.stringify({
          brandPageId: compareBrandPageId || undefined,
          competitorPageId: compareCompetitorPageId || undefined,
        }),
      },
    );
    setComparison(data.comparison);
    setMessage("Page comparison saved. Substantial competitor text is not reproduced.");
  }

  async function runAiAnalysis(id: string) {
    if (!apiBase || !organisationId) return;
    const data = await apiFetch<{ analysis: Record<string, unknown>; disclaimer: string }>(
      `${apiBase}/compare?organisationId=${organisationId}&competitorId=${id}&action=analyze`,
      { method: "POST", organisationId, body: "{}" },
    );
    setAiAnalysis(data.analysis);
    setMessage(data.disclaimer);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Competitor search intelligence"
        description="Compare public search presence using traceable public or licensed data only. No fabricated metrics."
      />

      <nav className="flex flex-wrap gap-2">
        {nav.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button variant={item.mode === mode ? "primary" : "outline"} size="sm">
              {item.label}
            </Button>
          </Link>
        ))}
        <Link href="/seo">
          <Button variant="outline" size="sm">SEO overview</Button>
        </Link>
      </nav>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {mode === "list" && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Add competitor</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Input label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Competitor name" />
              <Input label="Domain" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="example.com" />
              <label className="text-sm">
                Type
                <select className="mt-1 w-full rounded border p-2" value={newType} onChange={(e) => setNewType(e.target.value)}>
                  {COMPETITOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <Input label="Notes" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Optional notes" />
              <Button onClick={() => void addCompetitor()}>Add competitor</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Competitors ({competitors.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {competitors.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm">
                  <div>
                    <Link href={`/seo/competitors/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    <p className="text-muted-foreground">
                      {c.competitorType} · {c.domains?.[0]?.hostname ?? "—"} · {c._count?.pages ?? 0} pages
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{c.status}</Badge>
                    {c.status === "ACTIVE" ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => void startCrawl(c.id)}>Crawl</Button>
                        <Button size="sm" variant="outline" onClick={() => void archiveCompetitor(c.id)}>Archive</Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {mode === "detail" && competitor && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{competitor.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Type: {competitor.competitorType} · Status: {competitor.status}</p>
              <p>Domain: {competitor.domains?.map((d) => d.hostname).join(", ")}</p>
              {competitor.notes ? <p>Notes: {competitor.notes}</p> : null}
              <div className="flex flex-wrap gap-2 pt-2">
                {competitor.status === "ACTIVE" ? (
                  <>
                    <Button size="sm" onClick={() => void startCrawl(competitor.id)}>Start public crawl</Button>
                    <Button size="sm" variant="outline" onClick={() => void calculateOverlaps(competitor.id)}>Calculate overlaps</Button>
                    <Button size="sm" variant="outline" onClick={() => void detectGaps(competitor.id)}>Detect content gaps</Button>
                    <Button size="sm" variant="outline" onClick={() => void runAiAnalysis(competitor.id)}>AI analysis</Button>
                    <Button size="sm" variant="outline" onClick={() => void archiveCompetitor(competitor.id)}>Archive</Button>
                  </>
                ) : (
                  <Badge>Archived — crawl and analysis disabled</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Pages ({competitor._count?.pages ?? 0})</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(competitor.pages ?? []).map((p) => (
                  <div key={String(p.id)} className="rounded border p-2">
                    <p className="font-medium truncate">{String(p.title ?? p.url)}</p>
                    <p className="text-muted-foreground">{String(p.url)} · {String(p.wordCount ?? "—")} words</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Keywords</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-2">
                  <Input label="Keyword" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} placeholder="Add observed keyword" />
                  <Button size="sm" onClick={() => void addKeyword()}>Add</Button>
                </div>
                {(competitor.keywords ?? []).map((k) => (
                  <div key={String(k.id)} className="rounded border p-2 text-sm">
                    <p className="font-medium">{String(k.keyword)}</p>
                    <p className="text-muted-foreground">Source: {String(k.source)} · {String(k.observedAt)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {overlapSummary ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Overlap summary</CardTitle></CardHeader>
              <CardContent className="flex gap-4 text-sm">
                <span>Shared: {overlapSummary.shared}</span>
                <span>Brand unique: {overlapSummary.brandUnique}</span>
                <span>Competitor unique: {overlapSummary.competitorUnique}</span>
                <span>Missing source: {overlapSummary.withMissingSource}</span>
              </CardContent>
            </Card>
          ) : null}

          {aiAnalysis ? (
            <Card>
              <CardHeader><CardTitle className="text-base">AI analysis</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <p className="text-muted-foreground">{String((aiAnalysis as { limitations?: string }).limitations ?? "")}</p>
                <pre className="whitespace-pre-wrap text-xs bg-muted p-3 rounded">{JSON.stringify(aiAnalysis, null, 2)}</pre>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {mode === "keywords" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Competitor keyword observations</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">All observations include source and date. Search volume is never inferred from page text.</p>
            {keywords.map((k) => (
              <div key={String(k.id)} className="rounded border p-2">
                <p className="font-medium">{String(k.keyword)}</p>
                <p className="text-muted-foreground">
                  {String((k.competitor as { name?: string })?.name ?? "")} · Source: {String(k.source)} · {String(k.observedAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {mode === "content-gaps" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Content gaps</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {gaps.map((g) => (
              <div key={String(g.id)} className="rounded border p-3">
                <p className="font-medium">{String(g.title)}</p>
                <p className="text-muted-foreground">{String(g.explanation)}</p>
                <Badge className="mt-1">{String(g.gapType)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {mode === "topics" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Competitor topics</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {topics.map((t) => (
              <div key={String(t.id)} className="flex justify-between rounded border p-2">
                <span>{String(t.topic)}</span>
                <span className="text-muted-foreground">
                  {String((t.competitor as { name?: string })?.name ?? "")} · {String(t.pageCount)} pages
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {mode === "compare" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Page comparison</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <label className="text-sm block">
              Competitor
              <select
                className="mt-1 w-full rounded border p-2"
                value={compareCompetitorId}
                onChange={(e) => setCompareCompetitorId(e.target.value)}
              >
                <option value="">Select competitor</option>
                {competitors.filter((c) => c.status === "ACTIVE").map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <Input label="Brand page ID" value={compareBrandPageId} onChange={(e) => setCompareBrandPageId(e.target.value)} placeholder="Optional crawl page ID" />
            <Input label="Competitor page ID" value={compareCompetitorPageId} onChange={(e) => setCompareCompetitorPageId(e.target.value)} placeholder="Optional competitor page ID" />
            <Button onClick={() => void runCompare()}>Compare structure</Button>
            {comparison ? (
              <pre className="whitespace-pre-wrap text-xs bg-muted p-3 rounded">{JSON.stringify(comparison, null, 2)}</pre>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
