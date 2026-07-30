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

export type SeoViewMode =
  | "overview"
  | "sites"
  | "new"
  | "detail"
  | "crawl"
  | "pages"
  | "issues"
  | "links"
  | "sitemaps"
  | "structured-data"
  | "history";

type SeoSite = {
  id: string;
  name: string;
  primaryDomain: string;
  status: string;
  domains?: Array<{ hostname: string; verificationStatus: string }>;
  crawlConfiguration?: Record<string, unknown>;
  crawlRuns?: Array<Record<string, unknown>>;
  _count?: { crawlRuns: number; crawlPages: number; crawlIssues: number };
};

export function SeoView({
  mode,
  siteId,
}: {
  mode: SeoViewMode;
  siteId?: string;
}) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;

  const [sites, setSites] = useState<SeoSite[]>([]);
  const [site, setSite] = useState<SeoSite | null>(null);
  const [pages, setPages] = useState<Array<Record<string, unknown>>>([]);
  const [issues, setIssues] = useState<Array<Record<string, unknown>>>([]);
  const [links, setLinks] = useState<Array<Record<string, unknown>>>([]);
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
  const [comparison, setComparison] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [verification, setVerification] = useState<Record<string, unknown> | null>(null);

  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [baselineRunId, setBaselineRunId] = useState("");
  const [currentRunId, setCurrentRunId] = useState("");

  const apiBase = useMemo(() => {
    if (!brandId) return null;
    return `/api/brands/${brandId}/seo`;
  }, [brandId]);

  const loadSites = useCallback(async () => {
    if (!apiBase || !organisationId) return;
    const data = await apiFetch<{ items: SeoSite[] }>(`${apiBase}/sites?organisationId=${organisationId}`, {
      organisationId,
    });
    setSites(data.items);
  }, [apiBase, organisationId]);

  const loadSite = useCallback(async () => {
    if (!apiBase || !organisationId || !siteId) return;
    const data = await apiFetch<{ site: SeoSite }>(
      `${apiBase}/sites/${siteId}?organisationId=${organisationId}`,
      { organisationId },
    );
    setSite(data.site);
    setRuns(data.site.crawlRuns ?? []);
  }, [apiBase, organisationId, siteId]);

  const loadPages = useCallback(async () => {
    if (!apiBase || !organisationId || !siteId) return;
    const data = await apiFetch<{ items: Array<Record<string, unknown>> }>(
      `${apiBase}/sites/${siteId}/pages?organisationId=${organisationId}`,
      { organisationId },
    );
    setPages(data.items);
  }, [apiBase, organisationId, siteId]);

  const loadIssues = useCallback(async () => {
    if (!apiBase || !organisationId || !siteId) return;
    const data = await apiFetch<{ items: Array<Record<string, unknown>> }>(
      `${apiBase}/sites/${siteId}/issues?organisationId=${organisationId}`,
      { organisationId },
    );
    setIssues(data.items);
  }, [apiBase, organisationId, siteId]);

  const loadLinks = useCallback(async () => {
    if (!apiBase || !organisationId || !siteId) return;
    const data = await apiFetch<{ items: Array<Record<string, unknown>> }>(
      `${apiBase}/sites/${siteId}/links?organisationId=${organisationId}`,
      { organisationId },
    );
    setLinks(data.items);
  }, [apiBase, organisationId, siteId]);

  const loadRuns = useCallback(async () => {
    if (!apiBase || !organisationId || !siteId) return;
    const data = await apiFetch<{ runs: Array<Record<string, unknown>> }>(
      `${apiBase}/sites/${siteId}/crawl?organisationId=${organisationId}`,
      { organisationId },
    );
    setRuns(data.runs);
  }, [apiBase, organisationId, siteId]);

  useEffect(() => {
    void (async () => {
      try {
        if (mode === "sites" || mode === "overview") await loadSites();
        if (siteId && ["detail", "crawl", "pages", "issues", "links", "history", "sitemaps", "structured-data"].includes(mode)) {
          await loadSite();
        }
        if (mode === "pages") await loadPages();
        if (mode === "issues") await loadIssues();
        if (mode === "links") await loadLinks();
        if (mode === "crawl" || mode === "history") await loadRuns();
      } catch {
        setMessage("Failed to load SEO data.");
      }
    })();
  }, [mode, siteId, loadSites, loadSite, loadPages, loadIssues, loadLinks, loadRuns]);

  async function createSite() {
    if (!apiBase || !organisationId || !newName || !newDomain) return;
    await apiFetch(`${apiBase}/sites?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ name: newName, primaryDomain: newDomain }),
    });
    setMessage("Site created. Verify domain before crawling.");
    setNewName("");
    setNewDomain("");
    await loadSites();
  }

  async function startVerification() {
    if (!apiBase || !organisationId || !siteId) return;
    const data = await apiFetch<{ verification: Record<string, unknown> }>(
      `${apiBase}/sites/${siteId}/verify?organisationId=${organisationId}`,
      {
        method: "POST",
        organisationId,
        body: JSON.stringify({ method: "META_TAG" }),
      },
    );
    setVerification(data.verification);
    setMessage("Verification initiated. Add meta tag then check verification.");
  }

  async function checkVerification() {
    if (!apiBase || !organisationId || !siteId) return;
    const data = await apiFetch<{ verification: { verified: boolean } }>(
      `${apiBase}/sites/${siteId}/verify?organisationId=${organisationId}`,
      { organisationId },
    );
    if (data.verification.verified) {
      setMessage("Domain verified. Site is ready to crawl.");
      await loadSite();
    } else {
      setMessage("Verification not yet confirmed.");
    }
  }

  async function startCrawl() {
    if (!apiBase || !organisationId || !siteId) return;
    await apiFetch(`${apiBase}/sites/${siteId}/crawl?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ idempotencyKey: `manual-${Date.now()}` }),
    });
    setMessage("Crawl queued.");
    await loadRuns();
  }

  async function compareRuns() {
    if (!apiBase || !organisationId || !siteId || !baselineRunId || !currentRunId) return;
    const data = await apiFetch<{ comparison: Record<string, unknown> }>(
      `${apiBase}/sites/${siteId}/export?organisationId=${organisationId}`,
      {
        method: "POST",
        organisationId,
        body: JSON.stringify({ baselineRunId, currentRunId }),
      },
    );
    setComparison(data.comparison);
  }

  const siteNav = siteId
    ? [
        { label: "Overview", href: `/seo/sites/${siteId}`, mode: "detail" as const },
        { label: "Crawl", href: `/seo/sites/${siteId}/crawl`, mode: "crawl" as const },
        { label: "Pages", href: `/seo/sites/${siteId}/pages`, mode: "pages" as const },
        { label: "Issues", href: `/seo/sites/${siteId}/issues`, mode: "issues" as const },
        { label: "Links", href: `/seo/sites/${siteId}/links`, mode: "links" as const },
        { label: "History", href: `/seo/sites/${siteId}/history`, mode: "history" as const },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Technical SEO"
        description="Crawl verified websites, detect issues, and compare crawl runs."
      />

      {!siteId && (
        <nav className="flex flex-wrap gap-2">
          <Link href="/seo">
            <Button variant={mode === "overview" ? "primary" : "outline"} size="sm">Overview</Button>
          </Link>
          <Link href="/seo/sites">
            <Button variant={mode === "sites" ? "primary" : "outline"} size="sm">Sites</Button>
          </Link>
          <Link href="/seo/sites/new">
            <Button variant={mode === "new" ? "primary" : "outline"} size="sm">Add site</Button>
          </Link>
          <Link href="/seo/keywords">
            <Button variant="outline" size="sm">Keywords</Button>
          </Link>
          <Link href="/seo/competitors">
            <Button variant="outline" size="sm">Competitors</Button>
          </Link>
          <Link href="/seo/topics">
            <Button variant="outline" size="sm">Topics</Button>
          </Link>
          <Link href="/seo/briefs">
            <Button variant="outline" size="sm">Briefs</Button>
          </Link>
          <Link href="/seo/on-page">
            <Button variant="outline" size="sm">On-page SEO</Button>
          </Link>
          <Link href="/seo/internal-links">
            <Button variant="outline" size="sm">Internal links</Button>
          </Link>
        </nav>
      )}

      {siteId && (
        <nav className="flex flex-wrap gap-2">
          {siteNav.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button variant={item.mode === mode ? "primary" : "outline"} size="sm">
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>
      )}

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {mode === "overview" && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Sites</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{sites.length}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Verified</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">
              {sites.filter((s) => s.status === "ACTIVE").length}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Total issues</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">
              {sites.reduce((sum, s) => sum + (s._count?.crawlIssues ?? 0), 0)}
            </CardContent>
          </Card>
        </div>
      )}

      {(mode === "sites" || mode === "overview") && sites.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Registered sites</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {sites.map((s) => (
              <Link key={s.id} href={`/seo/sites/${s.id}`} className="flex items-center justify-between rounded border p-3 hover:bg-muted/50">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s.primaryDomain}</p>
                </div>
                <Badge>{s.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {mode === "new" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Add SEO site</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-w-md">
            <Input label="Site name" placeholder="Site name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input label="Primary domain" placeholder="Primary domain (e.g. example.com)" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
            <Button onClick={() => void createSite()}>Create site</Button>
          </CardContent>
        </Card>
      )}

      {mode === "detail" && site && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">{site.name}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Domain: {site.primaryDomain}</p>
              <p>Status: <Badge>{site.status}</Badge></p>
              <p>Pages crawled: {site._count?.crawlPages ?? 0}</p>
              <p>Issues: {site._count?.crawlIssues ?? 0}</p>
              {site.status !== "ACTIVE" && (
                <div className="space-y-2 pt-2">
                  <Button size="sm" onClick={() => void startVerification()}>Start verification</Button>
                  <Button size="sm" variant="outline" onClick={() => void checkVerification()}>Check verification</Button>
                  {verification?.instructions ? (
                    <p className="text-xs text-muted-foreground">{String(verification.instructions)}</p>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "crawl" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Crawl runs</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={() => void startCrawl()}>Start crawl</Button>
            {runs.map((run) => (
              <div key={String(run.id)} className="flex items-center justify-between rounded border p-3 text-sm">
                <span>{String(run.id).slice(0, 12)}…</span>
                <Badge>{String(run.status)}</Badge>
                <span>{String(run.pagesCrawled ?? 0)} pages</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {mode === "pages" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Page inventory ({pages.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pages.slice(0, 50).map((page) => {
              const snap = (page.snapshots as Array<Record<string, unknown>>)?.[0];
              return (
                <div key={String(page.id)} className="rounded border p-2 text-sm">
                  <p className="font-medium truncate">{String(page.normalisedUrl)}</p>
                  <p className="text-muted-foreground">{String(snap?.title ?? "—")} · {String(snap?.statusCode ?? page.lastStatusCode ?? "—")}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {mode === "issues" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Issues ({issues.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {issues.slice(0, 50).map((issue) => (
              <div key={String(issue.id)} className="rounded border p-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge>{String(issue.severity)}</Badge>
                  <span className="font-medium">{String(issue.ruleId)}</span>
                </div>
                <p className="truncate text-muted-foreground">{String(issue.affectedUrl)}</p>
                <p>{String(issue.explanation)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {mode === "links" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Links ({links.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {links.slice(0, 50).map((link) => (
              <div key={String(link.id)} className="rounded border p-2">
                <p className="truncate">{String(link.sourceUrl)} → {String(link.destinationUrl)}</p>
                <p className="text-muted-foreground">{String(link.linkType)} · {String(link.anchorText ?? "—")}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {mode === "history" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Crawl comparison</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input label="Baseline run ID" placeholder="Baseline run ID" value={baselineRunId} onChange={(e) => setBaselineRunId(e.target.value)} />
              <Input label="Current run ID" placeholder="Current run ID" value={currentRunId} onChange={(e) => setCurrentRunId(e.target.value)} />
              <Button onClick={() => void compareRuns()}>Compare</Button>
            </div>
            {comparison && (
              <pre className="overflow-auto rounded bg-muted p-3 text-xs">
                {JSON.stringify(comparison, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
