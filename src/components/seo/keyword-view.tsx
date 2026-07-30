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

export type KeywordViewMode =
  | "list"
  | "import"
  | "groups"
  | "opportunities"
  | "cannibalisation"
  | "detail";

type Keyword = {
  id: string;
  displayKeyword: string;
  normalisedKeyword: string;
  status: string;
  primaryIntent: string;
  language: string;
  country?: string;
  sources?: Array<{ sourceType: string; isSuggestion: boolean }>;
  metrics?: Array<{ metricType: string; value: number | null }>;
  tags?: Array<{ tag: string }>;
  _count?: { opportunities: number };
};

const nav: Array<{ label: string; href: string; mode: KeywordViewMode }> = [
  { label: "Keywords", href: "/seo/keywords", mode: "list" },
  { label: "Import", href: "/seo/keywords/import", mode: "import" },
  { label: "Groups", href: "/seo/keywords/groups", mode: "groups" },
  { label: "Opportunities", href: "/seo/keywords/opportunities", mode: "opportunities" },
  { label: "Cannibalisation", href: "/seo/keywords/cannibalisation", mode: "cannibalisation" },
];

export function KeywordView({ mode, keywordId }: { mode: KeywordViewMode; keywordId?: string }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;

  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [keyword, setKeyword] = useState<Keyword | null>(null);
  const [groups, setGroups] = useState<Array<Record<string, unknown>>>([]);
  const [opportunities, setOpportunities] = useState<Array<Record<string, unknown>>>([]);
  const [cannibalisation, setCannibalisation] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [csvContent, setCsvContent] = useState("keyword,language,volume\nexample keyword,en,100");

  const apiBase = useMemo(() => (brandId ? `/api/brands/${brandId}/seo/keywords` : null), [brandId]);

  const loadKeywords = useCallback(async () => {
    if (!apiBase || !organisationId) return;
    const params = new URLSearchParams({ organisationId });
    if (search) params.set("search", search);
    const data = await apiFetch<{ items: Keyword[] }>(`${apiBase}?${params}`, { organisationId });
    setKeywords(data.items);
  }, [apiBase, organisationId, search]);

  const loadKeyword = useCallback(async () => {
    if (!apiBase || !organisationId || !keywordId) return;
    const data = await apiFetch<{ keyword: Keyword }>(
      `${apiBase}/${keywordId}?organisationId=${organisationId}`,
      { organisationId },
    );
    setKeyword(data.keyword);
  }, [apiBase, organisationId, keywordId]);

  useEffect(() => {
    void (async () => {
      try {
        if (mode === "list") await loadKeywords();
        if (mode === "detail" && keywordId) await loadKeyword();
        if (mode === "groups" && apiBase && organisationId) {
          const data = await apiFetch<{ items: Array<Record<string, unknown>> }>(
            `${apiBase}/groups?organisationId=${organisationId}`,
            { organisationId },
          );
          setGroups(data.items);
        }
        if (mode === "opportunities" && apiBase && organisationId) {
          const data = await apiFetch<{ items: Array<Record<string, unknown>> }>(
            `${apiBase}/opportunities?organisationId=${organisationId}`,
            { organisationId },
          );
          setOpportunities(data.items);
        }
        if (mode === "cannibalisation" && apiBase && organisationId) {
          const data = await apiFetch<{ items: Array<Record<string, unknown>> }>(
            `${apiBase}/opportunities?organisationId=${organisationId}&type=cannibalisation`,
            { organisationId },
          );
          setCannibalisation(data.items);
        }
      } catch {
        setMessage("Failed to load keyword data.");
      }
    })();
  }, [mode, keywordId, loadKeywords, loadKeyword, apiBase, organisationId]);

  async function addKeyword() {
    if (!apiBase || !organisationId || !newKeyword.trim()) return;
    await apiFetch(`${apiBase}?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ keyword: newKeyword.trim() }),
    });
    setNewKeyword("");
    setMessage("Keyword added.");
    await loadKeywords();
  }

  async function syncGsc() {
    if (!apiBase || !organisationId) return;
    const result = await apiFetch<{ synced: number }>(
      `${apiBase}/opportunities?organisationId=${organisationId}&action=sync-gsc`,
      { method: "POST", organisationId, body: "{}" },
    );
    setMessage(`Synced ${result.synced} keywords from Search Console.`);
    await loadKeywords();
  }

  async function evaluateOpportunities() {
    if (!apiBase || !organisationId) return;
    const result = await apiFetch<{ created: number }>(
      `${apiBase}/opportunities?organisationId=${organisationId}&action=evaluate`,
      { method: "POST", organisationId, body: "{}" },
    );
    setMessage(`Created ${result.created} opportunities.`);
  }

  async function importCsv() {
    if (!apiBase || !organisationId) return;
    await apiFetch(`${apiBase}/import?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({
        fileName: "keywords.csv",
        csvContent,
        idempotencyKey: `import-${Date.now()}`,
      }),
    });
    setMessage("Import preview created. Confirm in API to process.");
  }

  const isSuggestion = (kw: Keyword) => kw.sources?.some((s) => s.isSuggestion);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Keyword intelligence"
        description="Organise keywords by intent, source, and page relationship. Real metrics only — never fabricated."
      />

      <nav className="flex flex-wrap gap-2">
        {nav.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button variant={item.mode === mode ? "primary" : "outline"} size="sm">
              {item.label}
            </Button>
          </Link>
        ))}
      </nav>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {mode === "list" && (
        <>
          <div className="flex flex-wrap gap-2">
            <Input label="Search" placeholder="Search keywords" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button size="sm" onClick={() => void loadKeywords()}>Search</Button>
            <Button size="sm" variant="outline" onClick={() => void syncGsc()}>Sync GSC</Button>
            <Button size="sm" variant="outline" onClick={() => void evaluateOpportunities()}>Evaluate opportunities</Button>
          </div>
          <div className="flex gap-2 max-w-md">
            <Input label="Add keyword" placeholder="Add keyword manually" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} />
            <Button onClick={() => void addKeyword()}>Add</Button>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Keywords ({keywords.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {keywords.map((kw) => (
                <Link key={kw.id} href={`/seo/keywords/${kw.id}`} className="flex items-center justify-between rounded border p-3 hover:bg-muted/50 text-sm">
                  <div>
                    <p className="font-medium">{kw.displayKeyword}</p>
                    <p className="text-muted-foreground">{kw.primaryIntent} · {kw.language}{kw.country ? ` · ${kw.country}` : ""}</p>
                  </div>
                  <div className="flex gap-2">
                    {isSuggestion(kw) ? <Badge>AI suggestion</Badge> : null}
                    <Badge>{kw.status}</Badge>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {mode === "import" && (
        <Card>
          <CardHeader><CardTitle className="text-base">CSV import</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className="w-full rounded border p-2 font-mono text-xs"
              rows={6}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
            />
            <Button onClick={() => void importCsv()}>Upload preview</Button>
          </CardContent>
        </Card>
      )}

      {mode === "groups" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Keyword groups ({groups.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {groups.map((g) => (
              <div key={String(g.id)} className="rounded border p-2">
                <p className="font-medium">{String(g.name)}</p>
                <p className="text-muted-foreground">{String(g.groupType)} · {String((g._count as { members?: number })?.members ?? 0)} keywords</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {mode === "opportunities" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Opportunities ({opportunities.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {opportunities.map((o) => (
              <div key={String(o.id)} className="rounded border p-2">
                <div className="flex gap-2"><Badge>{String(o.severity)}</Badge><span className="font-medium">{String(o.title)}</span></div>
                <p className="text-muted-foreground">{String(o.explanation)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {mode === "cannibalisation" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Cannibalisation candidates ({cannibalisation.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {cannibalisation.length === 0 ? (
              <p className="text-muted-foreground">No cannibalisation candidates detected.</p>
            ) : (
              cannibalisation.map((c, i) => (
                <div key={i} className="rounded border p-2">
                  <div className="flex gap-2"><Badge>{String(c.status)}</Badge><span>{String(c.keyword)}</span></div>
                  <p className="text-muted-foreground">{String(c.explanation)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {mode === "detail" && keyword && (
        <Card>
          <CardHeader><CardTitle className="text-base">{keyword.displayKeyword}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Intent: <Badge>{keyword.primaryIntent}</Badge></p>
            <p>Status: <Badge>{keyword.status}</Badge></p>
            {isSuggestion(keyword) ? <Badge>AI suggestion — not verified search demand</Badge> : null}
            {keyword.metrics?.map((m) => (
              <p key={m.metricType}>{m.metricType}: {m.value != null ? m.value : "—"}</p>
            ))}
            {keyword.tags?.map((t) => <Badge key={t.tag}>{t.tag}</Badge>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
