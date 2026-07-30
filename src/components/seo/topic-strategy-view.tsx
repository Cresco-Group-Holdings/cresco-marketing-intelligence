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

export type TopicStrategyViewMode = "topics" | "clusters" | "detail" | "strategy" | "roadmap";

type Topic = { id: string; name: string; slug: string; _count?: { clusters: number } };
type Cluster = {
  id: string;
  name: string;
  status: string;
  confidence?: number;
  isConfirmed: boolean;
  _count?: { members: number; pillarPages: number; supportingPages: number };
  members?: Array<Record<string, unknown>>;
  pillarPages?: Array<Record<string, unknown>>;
  supportingPages?: Array<Record<string, unknown>>;
  gapPlans?: Array<Record<string, unknown>>;
};

const nav: Array<{ label: string; href: string; mode: TopicStrategyViewMode }> = [
  { label: "Topics", href: "/seo/topics", mode: "topics" },
  { label: "Clusters", href: "/seo/clusters", mode: "clusters" },
  { label: "Strategy", href: "/seo/strategy", mode: "strategy" },
  { label: "Roadmap", href: "/seo/roadmap", mode: "roadmap" },
];

export function TopicStrategyView({
  mode,
  clusterId,
}: {
  mode: TopicStrategyViewMode;
  clusterId?: string;
}) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;

  const [topics, setTopics] = useState<Topic[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [graph, setGraph] = useState<Record<string, unknown> | null>(null);
  const [funnel, setFunnel] = useState<Array<Record<string, unknown>>>([]);
  const [strategies, setStrategies] = useState<Array<Record<string, unknown>>>([]);
  const [roadmap, setRoadmap] = useState<Record<string, unknown> | null>(null);
  const [aiProposal, setAiProposal] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newTopicName, setNewTopicName] = useState("");
  const [newClusterName, setNewClusterName] = useState("");
  const [newStrategyName, setNewStrategyName] = useState("");

  const apiBase = useMemo(() => (brandId ? `/api/brands/${brandId}/seo` : null), [brandId]);

  const loadTopics = useCallback(async () => {
    if (!apiBase || !organisationId) return;
    const data = await apiFetch<{ items: Topic[] }>(`${apiBase}/topics?organisationId=${organisationId}`, { organisationId });
    setTopics(data.items);
  }, [apiBase, organisationId]);

  const loadClusters = useCallback(async () => {
    if (!apiBase || !organisationId) return;
    const data = await apiFetch<{ items: Cluster[] }>(`${apiBase}/clusters?organisationId=${organisationId}`, { organisationId });
    setClusters(data.items);
  }, [apiBase, organisationId]);

  const loadCluster = useCallback(async () => {
    if (!apiBase || !organisationId || !clusterId) return;
    const [detail, graphData, funnelData] = await Promise.all([
      apiFetch<{ cluster: Cluster }>(`${apiBase}/clusters/${clusterId}?organisationId=${organisationId}`, { organisationId }),
      apiFetch<Record<string, unknown>>(`${apiBase}/clusters/${clusterId}?organisationId=${organisationId}&view=graph`, { organisationId }),
      apiFetch<{ coverage: Array<Record<string, unknown>> }>(`${apiBase}/clusters/${clusterId}?organisationId=${organisationId}&view=funnel`, { organisationId }),
    ]);
    setCluster(detail.cluster);
    setGraph(graphData);
    setFunnel(funnelData.coverage);
  }, [apiBase, organisationId, clusterId]);

  useEffect(() => {
    void (async () => {
      try {
        if (!apiBase || !organisationId) return;
        if (mode === "topics") await loadTopics();
        if (mode === "clusters") await loadClusters();
        if (mode === "detail" && clusterId) await loadCluster();
        if (mode === "strategy") {
          const data = await apiFetch<{ items: Array<Record<string, unknown>> }>(
            `${apiBase}/strategy?organisationId=${organisationId}`,
            { organisationId },
          );
          setStrategies(data.items);
        }
        if (mode === "roadmap") {
          const data = await apiFetch<Record<string, unknown>>(`${apiBase}/roadmap?organisationId=${organisationId}`, { organisationId });
          setRoadmap(data);
        }
      } catch {
        setMessage("Failed to load topic strategy data.");
      }
    })();
  }, [mode, clusterId, loadTopics, loadClusters, loadCluster, apiBase, organisationId]);

  async function addTopic() {
    if (!apiBase || !organisationId || !newTopicName.trim()) return;
    await apiFetch(`${apiBase}/topics?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ name: newTopicName.trim() }),
    });
    setNewTopicName("");
    setMessage("Topic created.");
    await loadTopics();
  }

  async function runClustering() {
    if (!apiBase || !organisationId) return;
    const result = await apiFetch<{ clusters: Cluster[] }>(
      `${apiBase}/clusters?organisationId=${organisationId}&action=cluster`,
      { method: "POST", organisationId, body: JSON.stringify({ includeCompetitorGaps: true }) },
    );
    setMessage(`Generated ${result.clusters.length} proposed clusters for review.`);
    await loadClusters();
  }

  async function confirmCluster(id: string) {
    if (!apiBase || !organisationId) return;
    await apiFetch(`${apiBase}/clusters/${id}?organisationId=${organisationId}`, {
      method: "PATCH",
      organisationId,
      body: JSON.stringify({ isConfirmed: true, status: "CONFIRMED" }),
    });
    setMessage("Cluster confirmed.");
    await loadClusters();
    if (clusterId === id) await loadCluster();
  }

  async function requestAiStrategy(id: string) {
    if (!apiBase || !organisationId) return;
    const data = await apiFetch<{ proposal: Record<string, unknown>; requiresApproval: boolean }>(
      `${apiBase}/clusters/${id}/ai?organisationId=${organisationId}`,
      { method: "POST", organisationId, body: "{}" },
    );
    setAiProposal(data.proposal);
    setMessage("AI strategy proposed — requires your approval before application.");
  }

  async function createStrategy() {
    if (!apiBase || !organisationId || !newStrategyName.trim()) return;
    await apiFetch(`${apiBase}/strategy?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ name: newStrategyName.trim() }),
    });
    setNewStrategyName("");
    setMessage("Strategy created with version 1 snapshot.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Topic clusters & content strategy"
        description="Organise keywords, pages, and competitor gaps into reviewable topic clusters and an actionable SEO roadmap."
      />

      <nav className="flex flex-wrap gap-2">
        {nav.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button variant={item.mode === mode ? "primary" : "outline"} size="sm">{item.label}</Button>
          </Link>
        ))}
      </nav>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {mode === "topics" && (
        <>
          <div className="flex gap-2 max-w-md">
            <Input label="Topic name" value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} placeholder="e.g. Email marketing" />
            <Button onClick={() => void addTopic()}>Add topic</Button>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Topics ({topics.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {topics.map((t) => (
                <div key={t.id} className="flex justify-between rounded border p-3 text-sm">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-muted-foreground">{t._count?.clusters ?? 0} clusters</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {mode === "clusters" && (
        <>
          <div className="flex flex-wrap gap-2">
            <Input label="Manual cluster" value={newClusterName} onChange={(e) => setNewClusterName(e.target.value)} placeholder="Cluster name" />
            <Button variant="outline" onClick={() => void runClustering()}>Run clustering</Button>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Clusters ({clusters.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {clusters.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm">
                  <div>
                    <Link href={`/seo/clusters/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    <p className="text-muted-foreground">{c._count?.members ?? 0} members · confidence {c.confidence?.toFixed(2) ?? "—"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge>{c.status}</Badge>
                    {!c.isConfirmed ? <Button size="sm" variant="outline" onClick={() => void confirmCluster(c.id)}>Confirm</Button> : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {mode === "detail" && cluster && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">{cluster.name}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Status: {cluster.status} · Members: {cluster.members?.length ?? 0}</p>
              <div className="flex flex-wrap gap-2">
                {!cluster.isConfirmed ? <Button size="sm" onClick={() => void confirmCluster(cluster.id)}>Confirm cluster</Button> : null}
                <Button size="sm" variant="outline" onClick={() => void requestAiStrategy(cluster.id)}>AI strategy proposal</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Cluster graph</CardTitle></CardHeader>
              <CardContent>
                {graph ? (
                  <p className="text-sm text-muted-foreground">
                    {(graph as { nodes?: unknown[] }).nodes?.length ?? 0} nodes
                    {(graph as { truncated?: boolean }).truncated ? " (truncated for performance)" : ""}
                  </p>
                ) : null}
                <pre className="mt-2 max-h-48 overflow-auto text-xs bg-muted p-2 rounded">{JSON.stringify(graph, null, 2)}</pre>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Intent / funnel coverage</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {funnel.map((f) => (
                  <div key={String(f.stage)} className="flex justify-between">
                    <span>{String(f.stage)}</span>
                    <span className="text-muted-foreground">{String(f.keywordCount)} kw · {String(f.pageCount)} pages</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {aiProposal ? (
            <Card>
              <CardHeader><CardTitle className="text-base">AI strategy proposal (pending approval)</CardTitle></CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-xs bg-muted p-3 rounded">{JSON.stringify(aiProposal, null, 2)}</pre>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {mode === "strategy" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Content strategies</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 max-w-md">
              <Input label="Strategy name" value={newStrategyName} onChange={(e) => setNewStrategyName(e.target.value)} />
              <Button onClick={() => void createStrategy()}>Create</Button>
            </div>
            {strategies.map((s) => (
              <div key={String(s.id)} className="rounded border p-3 text-sm">
                <p className="font-medium">{String(s.name)}</p>
                <p className="text-muted-foreground">Status: {String(s.status)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {mode === "roadmap" && roadmap && (
        <Card>
          <CardHeader><CardTitle className="text-base">Content roadmap</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">Connected to Content Operations when items move to DRAFTING.</p>
            {(["pillars", "supporting", "gapPlans"] as const).map((key) => (
              <div key={key}>
                <p className="font-medium capitalize">{key}</p>
                {((roadmap[key] as Array<Record<string, unknown>>) ?? []).map((item) => (
                  <div key={String(item.id)} className="ml-2 rounded border p-2 mt-1">
                    <p>{String(item.title)}</p>
                    <Badge className="mt-1">{String(item.roadmapStatus)}</Badge>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
