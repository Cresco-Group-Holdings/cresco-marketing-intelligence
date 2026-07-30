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

export type InternalLinksViewMode = "list" | "graph" | "issues" | "recommendations" | "page";

type LinkGraph = {
  id: string;
  status: string;
  nodeCount: number;
  edgeCount: number;
  metrics?: Record<string, unknown>;
  seoSite?: { name: string; primaryDomain: string };
  issues?: Array<{ id: string; title: string; issueType: string; severity: string; status: string }>;
  recommendations?: Array<{ id: string; suggestedAnchorConcept: string; confidence: number; status: string; contextualReason: string }>;
  nodes?: Array<{ id: string; url: string; title?: string; incomingCount: number; isOrphan: boolean; crawlDepth?: number }>;
  _count?: { nodes: number; issues: number; recommendations: number };
};

export function InternalLinksView({
  mode,
  graphId,
  pageId,
}: {
  mode: InternalLinksViewMode;
  graphId?: string;
  pageId?: string;
}) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;

  const [graphs, setGraphs] = useState<LinkGraph[]>([]);
  const [graph, setGraph] = useState<LinkGraph | null>(null);
  const [visualization, setVisualization] = useState<{ nodes: unknown[]; edges: unknown[]; truncated?: boolean; totalNodes?: number } | null>(null);
  const [orphans, setOrphans] = useState<Array<Record<string, unknown>>>([]);
  const [pageDetail, setPageDetail] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [seoSiteId, setSeoSiteId] = useState("");
  const [activeGraphId, setActiveGraphId] = useState(graphId ?? "");

  const apiBase = useMemo(() => (brandId ? `/api/brands/${brandId}/seo/internal-links` : null), [brandId]);

  const loadGraphs = useCallback(async () => {
    if (!apiBase || !organisationId) return;
    const data = await apiFetch<{ items: LinkGraph[] }>(`${apiBase}?organisationId=${organisationId}`, { organisationId });
    setGraphs(data.items);
    if (!activeGraphId && data.items[0]) setActiveGraphId(data.items[0].id);
  }, [apiBase, organisationId, activeGraphId]);

  const loadGraph = useCallback(async (gid: string) => {
    if (!apiBase || !organisationId) return;
    const data = await apiFetch<{ graph: LinkGraph }>(`${apiBase}/${gid}?organisationId=${organisationId}`, { organisationId });
    setGraph(data.graph);
  }, [apiBase, organisationId]);

  useEffect(() => {
    void (async () => {
      try {
        if (!apiBase || !organisationId) return;
        if (mode === "list") await loadGraphs();
        const gid = graphId ?? activeGraphId;
        if (!gid) return;
        if (mode === "graph") {
          const data = await apiFetch<{ nodes: unknown[]; edges: unknown[]; truncated: boolean; totalNodes: number }>(
            `${apiBase}/${gid}/graph?organisationId=${organisationId}`,
            { organisationId },
          );
          setVisualization(data);
        }
        if (mode === "issues") {
          const data = await apiFetch<{ issues: LinkGraph["issues"] }>(
            `${apiBase}/${gid}/issues?organisationId=${organisationId}`,
            { organisationId },
          );
          setGraph({ id: gid, status: "", nodeCount: 0, edgeCount: 0, issues: data.issues });
        }
        if (mode === "recommendations") {
          const data = await apiFetch<{ recommendations: LinkGraph["recommendations"] }>(
            `${apiBase}/${gid}/recommendations?organisationId=${organisationId}`,
            { organisationId },
          );
          setGraph({ id: gid, status: "", nodeCount: 0, edgeCount: 0, recommendations: data.recommendations });
        }
        if (mode === "page" && pageId) {
          const data = await apiFetch<{ page: Record<string, unknown> }>(
            `${apiBase}/pages/${pageId}?organisationId=${organisationId}&graphId=${gid}`,
            { organisationId },
          );
          setPageDetail(data.page);
        }
        if (mode === "list" && gid) await loadGraph(gid);
      } catch {
        setMessage("Failed to load internal link data.");
      }
    })();
  }, [mode, graphId, pageId, activeGraphId, loadGraphs, loadGraph, apiBase, organisationId]);

  async function buildGraph() {
    if (!apiBase || !organisationId || !seoSiteId) return;
    const data = await apiFetch<{ graph: LinkGraph }>(`${apiBase}?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ seoSiteId }),
    });
    setMessage("Graph built. No website changes made.");
    window.location.href = `/seo/internal-links?graph=${data.graph.id}`;
  }

  async function approveRecommendation(recId: string) {
    if (!apiBase || !organisationId || !activeGraphId) return;
    await apiFetch(`${apiBase}/${activeGraphId}?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ action: "APPROVE", recommendationId: recId }),
    });
    setMessage("Recommendation approved for manual implementation.");
    await loadGraph(activeGraphId);
  }

  const gid = graphId ?? activeGraphId;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Internal linking intelligence"
        description="Tenant-safe internal link graph and evidence-based recommendations. Does not modify websites."
      />

      <nav className="flex flex-wrap gap-2">
        <Link href="/seo/internal-links"><Button variant={mode === "list" ? "primary" : "outline"} size="sm">Overview</Button></Link>
        {gid ? (
          <>
            <Link href={`/seo/internal-links/graph${gid ? `?graph=${gid}` : ""}`}><Button variant={mode === "graph" ? "primary" : "outline"} size="sm">Graph</Button></Link>
            <Link href={`/seo/internal-links/issues${gid ? `?graph=${gid}` : ""}`}><Button variant={mode === "issues" ? "primary" : "outline"} size="sm">Issues</Button></Link>
            <Link href={`/seo/internal-links/recommendations${gid ? `?graph=${gid}` : ""}`}><Button variant={mode === "recommendations" ? "primary" : "outline"} size="sm">Recommendations</Button></Link>
          </>
        ) : null}
      </nav>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {mode === "list" && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Build graph</CardTitle></CardHeader>
            <CardContent className="grid gap-3 max-w-lg">
              <Input label="SEO site ID" value={seoSiteId} onChange={(e) => setSeoSiteId(e.target.value)} placeholder="SeoSite ID" />
              <Button onClick={() => void buildGraph()}>Build from crawl</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Graphs ({graphs.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {graphs.map((g) => (
                <div key={g.id} className="flex justify-between rounded border p-3 text-sm">
                  <div>
                    <p className="font-medium">{g.seoSite?.name ?? g.id}</p>
                    <p className="text-muted-foreground">{g.nodeCount} nodes · {g.edgeCount} edges · {g._count?.issues ?? 0} issues</p>
                  </div>
                  <Badge>{g.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          {graph && (
            <Card>
              <CardHeader><CardTitle className="text-base">Orphan pages</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(graph.nodes ?? []).filter((n) => n.isOrphan).slice(0, 10).map((n) => (
                  <Link key={n.id} href={`/seo/internal-links/pages/${n.id}?graph=${graph.id}`} className="block rounded border p-2 hover:bg-muted/50">
                    {n.title ?? n.url} · {n.incomingCount} incoming
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {mode === "graph" && visualization && (
        <Card>
          <CardHeader><CardTitle className="text-base">Graph view {visualization.truncated ? `(sampled from ${visualization.totalNodes})` : ""}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>{visualization.nodes.length} nodes · {visualization.edges.length} edges shown</p>
            <p className="text-muted-foreground">Large sites use aggregation/sampling for performance.</p>
          </CardContent>
        </Card>
      )}

      {mode === "issues" && graph?.issues && (
        <Card>
          <CardHeader><CardTitle className="text-base">Issues ({graph.issues.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {graph.issues.map((i) => (
              <div key={i.id} className="rounded border p-3 text-sm">
                <div className="flex justify-between"><span className="font-medium">{i.title}</span><Badge>{i.severity}</Badge></div>
                <p className="text-muted-foreground">{i.issueType}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {mode === "recommendations" && graph?.recommendations && (
        <Card>
          <CardHeader><CardTitle className="text-base">Recommendation queue ({graph.recommendations.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {graph.recommendations.map((r) => (
              <div key={r.id} className="rounded border p-3 text-sm space-y-1">
                <p className="font-medium">{r.suggestedAnchorConcept} (confidence: {Math.round(r.confidence * 100)}%)</p>
                <p className="text-muted-foreground">{r.contextualReason}</p>
                <Button size="sm" variant="outline" onClick={() => void approveRecommendation(r.id)}>Approve</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {mode === "page" && pageDetail && (
        <Card>
          <CardHeader><CardTitle className="text-base">Page neighbours</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className="font-medium">{String(pageDetail.title ?? pageDetail.url)}</p>
            <p>Incoming: {String(pageDetail.incomingCount)} · Outgoing: {String(pageDetail.outgoingCount)}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
