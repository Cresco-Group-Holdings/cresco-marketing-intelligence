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

export type BriefViewMode = "list" | "new" | "detail" | "history";

type Brief = {
  id: string;
  workingTitle?: string;
  status: string;
  contentType?: string;
  primaryKeyword?: { displayKeyword: string };
  cluster?: { name: string };
  keywords?: Array<{ keyword: string; role: string }>;
  headings?: Array<{ level: number; text: string }>;
  questions?: Array<{ question: string; isFaq: boolean }>;
  internalLinks?: Array<Record<string, unknown>>;
  schemaSuggestions?: Array<{ schemaType: string; rationale?: string }>;
  competitorEvidence?: Array<Record<string, unknown>>;
  versions?: Array<Record<string, unknown>>;
  comments?: Array<Record<string, unknown>>;
  _count?: { versions: number; comments: number };
};

export function BriefView({ mode, briefId }: { mode: BriefViewMode; briefId?: string }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;

  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [history, setHistory] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [keywordId, setKeywordId] = useState("");
  const [clusterId, setClusterId] = useState("");
  const [comment, setComment] = useState("");

  const apiBase = useMemo(() => (brandId ? `/api/brands/${brandId}/seo/briefs` : null), [brandId]);

  const loadBriefs = useCallback(async () => {
    if (!apiBase || !organisationId) return;
    const data = await apiFetch<{ items: Brief[] }>(`${apiBase}?organisationId=${organisationId}`, { organisationId });
    setBriefs(data.items);
  }, [apiBase, organisationId]);

  const loadBrief = useCallback(async () => {
    if (!apiBase || !organisationId || !briefId) return;
    const data = await apiFetch<{ brief: Brief }>(`${apiBase}/${briefId}?organisationId=${organisationId}`, { organisationId });
    setBrief(data.brief);
  }, [apiBase, organisationId, briefId]);

  useEffect(() => {
    void (async () => {
      try {
        if (!apiBase || !organisationId) return;
        if (mode === "list") await loadBriefs();
        if (mode === "detail" && briefId) await loadBrief();
        if (mode === "history" && briefId) {
          const data = await apiFetch<Record<string, unknown>>(
            `${apiBase}/${briefId}/history?organisationId=${organisationId}`,
            { organisationId },
          );
          setHistory(data);
        }
      } catch {
        setMessage("Failed to load brief data.");
      }
    })();
  }, [mode, briefId, loadBriefs, loadBrief, apiBase, organisationId]);

  async function createBrief() {
    if (!apiBase || !organisationId) return;
    const data = await apiFetch<{ brief: Brief }>(`${apiBase}?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({
        workingTitle: title.trim() || undefined,
        primaryKeywordId: keywordId || undefined,
        clusterId: clusterId || undefined,
      }),
    });
    setMessage("Brief draft created.");
    window.location.href = `/seo/briefs/${data.brief.id}`;
  }

  async function generateBrief() {
    if (!apiBase || !organisationId || !briefId) return;
    await apiFetch(`${apiBase}/${briefId}?organisationId=${organisationId}&action=generate`, {
      method: "POST",
      organisationId,
      body: "{}",
    });
    setMessage("Brief generated from evidence. Full article not included.");
    await loadBrief();
  }

  async function submitReview() {
    if (!apiBase || !organisationId || !briefId) return;
    await apiFetch(`${apiBase}/${briefId}?organisationId=${organisationId}&action=submit-review`, {
      method: "POST",
      organisationId,
      body: "{}",
    });
    setMessage("Submitted for review.");
    await loadBrief();
  }

  async function approveBrief() {
    if (!apiBase || !organisationId || !briefId) return;
    await apiFetch(`${apiBase}/${briefId}?organisationId=${organisationId}&action=approve`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ decision: "APPROVED" }),
    });
    setMessage("Brief approved.");
    await loadBrief();
  }

  async function addComment() {
    if (!apiBase || !organisationId || !briefId || !comment.trim()) return;
    await apiFetch(`${apiBase}/${briefId}?organisationId=${organisationId}&action=comment`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ body: comment.trim() }),
    });
    setComment("");
    setMessage("Comment added.");
    await loadBrief();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="SEO content briefs"
        description="Evidence-grounded content briefs for approved keywords and topics. Does not generate the full article."
      />

      <nav className="flex flex-wrap gap-2">
        <Link href="/seo/briefs"><Button variant={mode === "list" ? "primary" : "outline"} size="sm">Briefs</Button></Link>
        <Link href="/seo/briefs/new"><Button variant={mode === "new" ? "primary" : "outline"} size="sm">New brief</Button></Link>
        {briefId ? (
          <>
            <Link href={`/seo/briefs/${briefId}`}><Button variant={mode === "detail" ? "primary" : "outline"} size="sm">Detail</Button></Link>
            <Link href={`/seo/briefs/${briefId}/history`}><Button variant={mode === "history" ? "primary" : "outline"} size="sm">History</Button></Link>
          </>
        ) : null}
      </nav>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {mode === "list" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Briefs ({briefs.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {briefs.map((b) => (
              <Link key={b.id} href={`/seo/briefs/${b.id}`} className="flex justify-between rounded border p-3 hover:bg-muted/50 text-sm">
                <div>
                  <p className="font-medium">{b.workingTitle ?? "Untitled brief"}</p>
                  <p className="text-muted-foreground">{b.primaryKeyword?.displayKeyword ?? "—"} · {b._count?.versions ?? 0} versions</p>
                </div>
                <Badge>{b.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {mode === "new" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Create brief</CardTitle></CardHeader>
          <CardContent className="grid gap-3 max-w-lg">
            <Input label="Working title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional title" />
            <Input label="Primary keyword ID" value={keywordId} onChange={(e) => setKeywordId(e.target.value)} placeholder="SeoKeyword ID" />
            <Input label="Cluster ID" value={clusterId} onChange={(e) => setClusterId(e.target.value)} placeholder="Optional cluster ID" />
            <Button onClick={() => void createBrief()}>Create draft</Button>
          </CardContent>
        </Card>
      )}

      {mode === "detail" && brief && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">{brief.workingTitle ?? "Untitled brief"}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Status: {brief.status} · Keyword: {brief.primaryKeyword?.displayKeyword ?? "—"}</p>
              <div className="flex flex-wrap gap-2">
                {brief.status === "DRAFT" || brief.status === "CHANGES_REQUESTED" ? (
                  <Button size="sm" onClick={() => void generateBrief()}>Generate brief</Button>
                ) : null}
                {brief.status === "GENERATED" || brief.status === "CHANGES_REQUESTED" ? (
                  <Button size="sm" variant="outline" onClick={() => void submitReview()}>Submit for review</Button>
                ) : null}
                {brief.status === "IN_REVIEW" ? (
                  <Button size="sm" variant="outline" onClick={() => void approveBrief()}>Approve</Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Outline & headings</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {(brief.headings ?? []).map((h, i) => (
                  <p key={i} style={{ paddingLeft: (h.level - 1) * 12 }}>H{h.level}: {h.text}</p>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Questions & schema</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(brief.questions ?? []).map((q, i) => (
                  <p key={i}>{q.isFaq ? "[FAQ] " : ""}{q.question}</p>
                ))}
                {(brief.schemaSuggestions ?? []).map((s, i) => (
                  <p key={i} className="text-muted-foreground">{s.schemaType}: {s.rationale}</p>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Internal link suggestions</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <p className="text-muted-foreground">Suggestions only — links are not automatically inserted.</p>
              {(brief.internalLinks ?? []).map((l, i) => (
                <div key={i} className="rounded border p-2">
                  <p>{String(l.suggestedAnchorConcept)} → {String(l.destinationUrl ?? l.destinationPageId)}</p>
                  <p className="text-muted-foreground">{String(l.reason)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Comments</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Input label="Comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add review comment" />
                <Button size="sm" onClick={() => void addComment()}>Add</Button>
              </div>
              {(brief.comments ?? []).map((c, i) => (
                <p key={i} className="text-sm rounded border p-2">{String(c.body)}</p>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {mode === "history" && history && (
        <Card>
          <CardHeader><CardTitle className="text-base">Version history</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {((history.versions as Array<Record<string, unknown>>) ?? []).map((v) => (
              <div key={String(v.id)} className="rounded border p-2">
                <p>Version {String(v.versionNumber)} · {String(v.status)} · {String(v.createdAt)}</p>
                {v.aiModel ? <p className="text-muted-foreground">AI: {String(v.aiProvider)} / {String(v.aiModel)}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
