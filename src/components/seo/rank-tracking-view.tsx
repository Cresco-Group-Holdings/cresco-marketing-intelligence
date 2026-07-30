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

export type RankTrackingViewMode =
  | "overview"
  | "keywords"
  | "pages"
  | "changes"
  | "refresh"
  | "refresh-detail";

type RankProject = {
  id: string;
  name: string;
  status: string;
  keywordCount: number;
  keywordQuota: number;
  lastSyncAt?: string;
  seoSite?: { name: string; primaryDomain: string };
  trackedKeywords?: Array<{
    id: string;
    keyword: string;
    country: string;
    device: string;
    priority: number;
    status: string;
    observations?: Array<{ observedDate: string; rank: number | null }>;
  }>;
  rankChanges?: Array<{ id: string; changeType: string; severity: string; detectedAt: string }>;
  _count?: { trackedKeywords: number; refreshCandidates: number };
};

type RefreshCandidate = {
  id: string;
  url: string;
  title?: string;
  decayScore: number;
  status: string;
  signals: unknown;
  recommendations?: Array<{
    id: string;
    recommendationType: string;
    confidence: number;
    expectedHypothesis: string;
    measurementPlan: string;
  }>;
};

export function RankTrackingView({
  mode,
  projectId,
  candidateId,
}: {
  mode: RankTrackingViewMode;
  projectId?: string;
  candidateId?: string;
}) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;

  const [projects, setProjects] = useState<RankProject[]>([]);
  const [project, setProject] = useState<RankProject | null>(null);
  const [changes, setChanges] = useState<Array<Record<string, unknown>>>([]);
  const [pages, setPages] = useState<Array<Record<string, unknown>>>([]);
  const [candidates, setCandidates] = useState<RefreshCandidate[]>([]);
  const [candidate, setCandidate] = useState<RefreshCandidate | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState(projectId ?? "");
  const [newProjectName, setNewProjectName] = useState("");
  const [seoSiteId, setSeoSiteId] = useState("");
  const [newKeyword, setNewKeyword] = useState("");

  const rankingsBase = useMemo(
    () => (brandId ? `/api/brands/${brandId}/seo/rankings` : null),
    [brandId],
  );
  const refreshBase = useMemo(
    () => (brandId ? `/api/brands/${brandId}/seo/content-refresh` : null),
    [brandId],
  );

  const loadProjects = useCallback(async () => {
    if (!rankingsBase || !organisationId) return;
    const data = await apiFetch<{ items: RankProject[] }>(
      `${rankingsBase}?organisationId=${organisationId}`,
      { organisationId },
    );
    setProjects(data.items);
    if (!activeProjectId && data.items[0]) setActiveProjectId(data.items[0].id);
  }, [rankingsBase, organisationId, activeProjectId]);

  const loadProject = useCallback(async (pid: string) => {
    if (!rankingsBase || !organisationId) return;
    const data = await apiFetch<{ project: RankProject }>(
      `${rankingsBase}/${pid}?organisationId=${organisationId}`,
      { organisationId },
    );
    setProject(data.project);
  }, [rankingsBase, organisationId]);

  useEffect(() => {
    void (async () => {
      try {
        if (!organisationId) return;
        if (mode === "overview" || mode === "keywords") await loadProjects();
        const pid = projectId ?? activeProjectId;
        if (!pid || !rankingsBase) return;
        if (mode === "keywords" || mode === "overview") await loadProject(pid);
        if (mode === "changes") {
          const data = await apiFetch<{ changes: Array<Record<string, unknown>> }>(
            `${rankingsBase}/${pid}?organisationId=${organisationId}&action=changes`,
            { organisationId },
          );
          setChanges(data.changes);
        }
        if (mode === "pages") {
          const data = await apiFetch<{ pages: Array<Record<string, unknown>> }>(
            `${rankingsBase}/${pid}?organisationId=${organisationId}&action=pages`,
            { organisationId },
          );
          setPages(data.pages);
        }
        if (mode === "refresh" && refreshBase) {
          const data = await apiFetch<{ candidates: RefreshCandidate[] }>(
            `${refreshBase}?organisationId=${organisationId}${pid ? `&projectId=${pid}` : ""}`,
            { organisationId },
          );
          setCandidates(data.candidates);
        }
        if (mode === "refresh-detail" && candidateId && refreshBase) {
          const data = await apiFetch<{ candidate: RefreshCandidate }>(
            `${refreshBase}/${candidateId}?organisationId=${organisationId}`,
            { organisationId },
          );
          setCandidate(data.candidate);
        }
      } catch {
        setMessage("Failed to load rank tracking data.");
      }
    })();
  }, [mode, projectId, candidateId, activeProjectId, loadProjects, loadProject, rankingsBase, refreshBase, organisationId]);

  async function createProject() {
    if (!rankingsBase || !organisationId || !seoSiteId || !newProjectName) return;
    const data = await apiFetch<{ project: RankProject }>(`${rankingsBase}?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ seoSiteId, name: newProjectName }),
    });
    setMessage("Rank tracking project created.");
    setActiveProjectId(data.project.id);
    await loadProjects();
  }

  async function addKeyword() {
    const pid = projectId ?? activeProjectId;
    if (!rankingsBase || !organisationId || !pid || !newKeyword) return;
    await apiFetch(`${rankingsBase}/${pid}?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ keyword: newKeyword }),
    });
    setMessage("Keyword added to tracking.");
    setNewKeyword("");
    await loadProject(pid);
  }

  async function scanDecay() {
    const pid = projectId ?? activeProjectId;
    if (!rankingsBase || !organisationId || !pid) return;
    const data = await apiFetch<{ candidates: RefreshCandidate[] }>(
      `${rankingsBase}/${pid}?organisationId=${organisationId}`,
      { method: "POST", organisationId, body: JSON.stringify({ action: "scan-decay" }) },
    );
    setMessage(`Found ${data.candidates.length} refresh candidates. No automatic publishing.`);
  }

  async function convertRecommendation(recId: string, workflowType: string) {
    if (!refreshBase || !organisationId || !candidateId) return;
    await apiFetch(`${refreshBase}/${candidateId}?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ recommendationId: recId, workflowType }),
    });
    setMessage("Recommendation converted to workflow item.");
  }

  const pid = projectId ?? activeProjectId;
  const qs = pid ? `?project=${pid}` : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rank tracking & content refresh"
        description="Track search visibility over time and convert evidence of decline into controlled refresh work. Licensed data sources only."
      />

      <nav className="flex flex-wrap gap-2">
        <Link href={`/seo/rankings${qs}`}><Button variant={mode === "overview" ? "primary" : "outline"} size="sm">Overview</Button></Link>
        <Link href={`/seo/rankings/keywords${qs}`}><Button variant={mode === "keywords" ? "primary" : "outline"} size="sm">Keywords</Button></Link>
        {pid ? (
          <>
            <Link href={`/seo/rankings/pages${qs}`}><Button variant={mode === "pages" ? "primary" : "outline"} size="sm">Pages</Button></Link>
            <Link href={`/seo/rankings/changes${qs}`}><Button variant={mode === "changes" ? "primary" : "outline"} size="sm">Changes</Button></Link>
          </>
        ) : null}
        <Link href={`/seo/content-refresh${qs}`}><Button variant={mode === "refresh" || mode === "refresh-detail" ? "primary" : "outline"} size="sm">Content refresh</Button></Link>
      </nav>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {mode === "overview" && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Create project</CardTitle></CardHeader>
            <CardContent className="grid gap-3 max-w-lg">
              <Input label="Project name" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
              <Input label="SEO site ID" value={seoSiteId} onChange={(e) => setSeoSiteId(e.target.value)} />
              <Button onClick={() => void createProject()}>Create project</Button>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((p) => (
              <Card key={p.id}>
                <CardHeader><CardTitle className="text-base">{p.name}</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>{p.seoSite?.primaryDomain}</p>
                  <p>Keywords: {p.keywordCount} / {p.keywordQuota}</p>
                  <Badge>{p.status}</Badge>
                  {p.lastSyncAt ? <p className="text-muted-foreground">Last sync: {new Date(p.lastSyncAt).toLocaleDateString()}</p> : null}
                  <Link href={`/seo/rankings/keywords?project=${p.id}`}><Button size="sm" variant="outline">View keywords</Button></Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {mode === "keywords" && project && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Add tracked keyword</CardTitle></CardHeader>
            <CardContent className="flex gap-2 max-w-lg">
              <Input label="Keyword" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} />
              <Button onClick={() => void addKeyword()}>Add</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tracked keywords ({project.trackedKeywords?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {project.trackedKeywords?.map((kw) => {
                const latest = kw.observations?.[0];
                const prev = kw.observations?.[1];
                return (
                  <div key={kw.id} className="flex items-center justify-between border-b pb-2 text-sm">
                    <div>
                      <p className="font-medium">{kw.keyword}</p>
                      <p className="text-muted-foreground">{kw.country} · {kw.device}</p>
                    </div>
                    <div className="text-right">
                      <p>Position: {latest?.rank ?? "—"}</p>
                      {prev?.rank != null && latest?.rank != null ? (
                        <p className={latest.rank < prev.rank ? "text-green-600" : latest.rank > prev.rank ? "text-red-600" : ""}>
                          {latest.rank < prev.rank ? "↑" : latest.rank > prev.rank ? "↓" : "—"} from {prev.rank}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <Button variant="outline" onClick={() => void scanDecay()}>Scan for content decay</Button>
        </>
      )}

      {mode === "changes" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Rank changes & alerts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {changes.map((c) => (
              <div key={c.id as string} className="flex justify-between border-b pb-2 text-sm">
                <span>{c.changeType as string}</span>
                <Badge>{c.severity as string}</Badge>
                <span className="text-muted-foreground">{new Date(c.detectedAt as string).toLocaleDateString()}</span>
              </div>
            ))}
            {changes.length === 0 ? <p className="text-muted-foreground">No rank changes detected yet.</p> : null}
          </CardContent>
        </Card>
      )}

      {mode === "pages" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Ranking URLs</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pages.map((p) => (
              <div key={p.id as string} className="border-b pb-2 text-sm">
                <p className="font-medium truncate">{(p.url as string) ?? (p.crawlPage as { normalisedUrl: string })?.normalisedUrl}</p>
                <p className="text-muted-foreground">{(p.trackedKeyword as { keyword: string })?.keyword}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {mode === "refresh" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Content refresh candidates</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {candidates.map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b pb-2">
                <div>
                  <p className="font-medium text-sm">{c.title ?? c.url}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-md">{c.url}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>Score {(c.decayScore * 100).toFixed(0)}%</Badge>
                  <Link href={`/seo/content-refresh/${c.id}${qs}`}><Button size="sm" variant="outline">Review</Button></Link>
                </div>
              </div>
            ))}
            {candidates.length === 0 ? <p className="text-muted-foreground">No refresh candidates. Run a decay scan from Keywords.</p> : null}
          </CardContent>
        </Card>
      )}

      {mode === "refresh-detail" && candidate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{candidate.title ?? candidate.url}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{candidate.url}</p>
            <Badge>Decay score {(candidate.decayScore * 100).toFixed(0)}%</Badge>
            {candidate.recommendations?.map((rec) => (
              <div key={rec.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex justify-between">
                  <p className="font-medium text-sm">{rec.recommendationType.replace(/_/g, " ")}</p>
                  <Badge>{(rec.confidence * 100).toFixed(0)}% confidence</Badge>
                </div>
                <p className="text-sm">{rec.expectedHypothesis}</p>
                <p className="text-xs text-muted-foreground">{rec.measurementPlan}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void convertRecommendation(rec.id, "SEO_BRIEF")}>→ SEO brief</Button>
                  <Button size="sm" variant="outline" onClick={() => void convertRecommendation(rec.id, "CONTENT_TASK")}>→ Content task</Button>
                  <Button size="sm" variant="outline" onClick={() => void convertRecommendation(rec.id, "LONG_FORM_REVISION")}>→ Long-form</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
