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

export type LongFormViewMode = "list" | "new" | "detail" | "history" | "review";

type LongFormDocument = {
  id: string;
  title?: string;
  status: string;
  contentType?: string;
  metaDescription?: string;
  brief?: { id: string; workingTitle?: string; status: string };
  sections?: Array<{
    id: string;
    sortOrder: number;
    heading?: string;
    body: string;
    isLocked: boolean;
    blockType: string;
  }>;
  claims?: Array<{ id: string; claimText: string; classification: string; flagged: boolean }>;
  citations?: Array<{ id: string; label: string; url?: string }>;
  generationRuns?: Array<Record<string, unknown>>;
  reviews?: Array<Record<string, unknown>>;
  versions?: Array<Record<string, unknown>>;
  exports?: Array<Record<string, unknown>>;
  _count?: { versions: number; sections: number; claims: number };
};

type SeoReport = {
  briefCoverage?: { covered: string[]; missing: string[] };
  keywordCoverage?: Array<{ keyword: string; count: number }>;
  unsupportedClaims?: number;
  contentLength?: { words: number; status: string };
  notes?: string[];
};

export function LongFormView({ mode, documentId }: { mode: LongFormViewMode; documentId?: string }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;

  const [documents, setDocuments] = useState<LongFormDocument[]>([]);
  const [document, setDocument] = useState<LongFormDocument | null>(null);
  const [history, setHistory] = useState<Record<string, unknown> | null>(null);
  const [reviewSummary, setReviewSummary] = useState<{ seoReport?: SeoReport; compliance?: { findings: unknown[] } } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [briefId, setBriefId] = useState("");
  const [title, setTitle] = useState("");

  const apiBase = useMemo(() => (brandId ? `/api/brands/${brandId}/content/long-form` : null), [brandId]);

  const loadDocuments = useCallback(async () => {
    if (!apiBase || !organisationId) return;
    const data = await apiFetch<{ items: LongFormDocument[] }>(`${apiBase}?organisationId=${organisationId}`, { organisationId });
    setDocuments(data.items);
  }, [apiBase, organisationId]);

  const loadDocument = useCallback(async () => {
    if (!apiBase || !organisationId || !documentId) return;
    const data = await apiFetch<{ document: LongFormDocument }>(
      `${apiBase}/${documentId}?organisationId=${organisationId}`,
      { organisationId },
    );
    setDocument(data.document);
  }, [apiBase, organisationId, documentId]);

  useEffect(() => {
    void (async () => {
      try {
        if (!apiBase || !organisationId) return;
        if (mode === "list") await loadDocuments();
        if (mode === "detail" && documentId) await loadDocument();
        if (mode === "history" && documentId) {
          const data = await apiFetch<Record<string, unknown>>(
            `${apiBase}/${documentId}/history?organisationId=${organisationId}`,
            { organisationId },
          );
          setHistory(data);
        }
        if (mode === "review" && documentId) {
          const data = await apiFetch<{ summary: { seoReport: SeoReport; compliance: { findings: unknown[] } } }>(
            `${apiBase}/${documentId}/review?organisationId=${organisationId}`,
            { organisationId },
          );
          setReviewSummary(data.summary);
          await loadDocument();
        }
      } catch {
        setMessage("Failed to load long-form content data.");
      }
    })();
  }, [mode, documentId, loadDocuments, loadDocument, apiBase, organisationId]);

  async function createDocument() {
    if (!apiBase || !organisationId || !briefId) return;
    const data = await apiFetch<{ document: LongFormDocument }>(`${apiBase}?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ briefId, title: title.trim() || undefined }),
    });
    setMessage("Document created from approved brief.");
    window.location.href = `/content/long-form/${data.document.id}`;
  }

  async function generateOutline() {
    if (!apiBase || !organisationId || !documentId) return;
    await apiFetch(`${apiBase}/${documentId}?organisationId=${organisationId}&action=generate-outline`, {
      method: "POST",
      organisationId,
      body: "{}",
    });
    setMessage("Outline generated.");
    await loadDocument();
  }

  async function confirmOutline() {
    if (!apiBase || !organisationId || !documentId) return;
    await apiFetch(`${apiBase}/${documentId}?organisationId=${organisationId}&action=confirm-outline`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ confirmed: true }),
    });
    setMessage("Outline confirmed.");
    await loadDocument();
  }

  async function generateSections() {
    if (!apiBase || !organisationId || !documentId) return;
    await apiFetch(`${apiBase}/${documentId}?organisationId=${organisationId}&action=generate-sections`, {
      method: "POST",
      organisationId,
      body: "{}",
    });
    setMessage("Sections generated section-by-section.");
    await loadDocument();
  }

  async function submitReview() {
    if (!apiBase || !organisationId || !documentId) return;
    await apiFetch(`${apiBase}/${documentId}?organisationId=${organisationId}&action=submit-review`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ stage: "EVIDENCE" }),
    });
    setMessage("Submitted for evidence review.");
    await loadDocument();
  }

  async function approveFinal() {
    if (!apiBase || !organisationId || !documentId) return;
    await apiFetch(`${apiBase}/${documentId}?organisationId=${organisationId}&action=review-decide`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ stage: "FINAL", decision: "APPROVED" }),
    });
    setMessage("Document approved — publish-ready export available.");
    await loadDocument();
  }

  async function exportDocument(format: string) {
    if (!apiBase || !organisationId || !documentId) return;
    await apiFetch(`${apiBase}/${documentId}/export?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ format }),
    });
    setMessage(`Exported as ${format}. No automatic publishing.`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Long-form SEO content"
        description="Generate and edit long-form SEO content from approved briefs with evidence, compliance, and provenance controls."
      />

      <nav className="flex flex-wrap gap-2">
        <Link href="/content/long-form"><Button variant={mode === "list" ? "primary" : "outline"} size="sm">Documents</Button></Link>
        <Link href="/content/long-form/new"><Button variant={mode === "new" ? "primary" : "outline"} size="sm">New document</Button></Link>
        {documentId ? (
          <>
            <Link href={`/content/long-form/${documentId}`}><Button variant={mode === "detail" ? "primary" : "outline"} size="sm">Editor</Button></Link>
            <Link href={`/content/long-form/${documentId}/history`}><Button variant={mode === "history" ? "primary" : "outline"} size="sm">History</Button></Link>
            <Link href={`/content/long-form/${documentId}/review`}><Button variant={mode === "review" ? "primary" : "outline"} size="sm">Review</Button></Link>
          </>
        ) : null}
      </nav>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {mode === "list" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Documents ({documents.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {documents.map((d) => (
              <Link key={d.id} href={`/content/long-form/${d.id}`} className="flex justify-between rounded border p-3 hover:bg-muted/50 text-sm">
                <div>
                  <p className="font-medium">{d.title ?? "Untitled"}</p>
                  <p className="text-muted-foreground">{d.brief?.workingTitle ?? "—"} · {d._count?.sections ?? 0} sections</p>
                </div>
                <Badge>{d.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {mode === "new" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Create from approved brief</CardTitle></CardHeader>
          <CardContent className="grid gap-3 max-w-lg">
            <Input label="Approved brief ID" value={briefId} onChange={(e) => setBriefId(e.target.value)} placeholder="SeoContentBrief ID (must be APPROVED)" />
            <Input label="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Override title" />
            <Button onClick={() => void createDocument()}>Create document</Button>
          </CardContent>
        </Card>
      )}

      {mode === "detail" && document && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">{document.title ?? "Untitled"}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Status: {document.status} · Brief: {document.brief?.workingTitle ?? "—"}</p>
              <div className="flex flex-wrap gap-2">
                {document.status === "OUTLINE_PENDING" ? (
                  <>
                    <Button size="sm" onClick={() => void generateOutline()}>Generate outline</Button>
                    <Button size="sm" variant="outline" onClick={() => void confirmOutline()}>Confirm outline</Button>
                  </>
                ) : null}
                {["OUTLINE_CONFIRMED", "SECTIONS_DRAFT"].includes(document.status) ? (
                  <Button size="sm" onClick={() => void generateSections()}>Generate sections</Button>
                ) : null}
                {document.status === "SECTIONS_DRAFT" ? (
                  <Button size="sm" variant="outline" onClick={() => void submitReview()}>Submit for review</Button>
                ) : null}
                {["PENDING_APPROVAL", "COMPLIANCE_REVIEW"].includes(document.status) ? (
                  <Button size="sm" onClick={() => void approveFinal()}>Approve</Button>
                ) : null}
                {["APPROVED", "PUBLISH_READY"].includes(document.status) ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => void exportDocument("HTML")}>Export HTML</Button>
                    <Button size="sm" variant="outline" onClick={() => void exportDocument("MARKDOWN")}>Export Markdown</Button>
                    <Button size="sm" variant="outline" onClick={() => void exportDocument("CMS_PAYLOAD")}>CMS payload</Button>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Sections ({document.sections?.length ?? 0})</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {(document.sections ?? []).map((section) => (
                <div key={section.id} className="rounded border p-3 space-y-2">
                  {section.heading ? <p className="font-medium">{section.heading} {section.isLocked ? "🔒" : ""}</p> : null}
                  <p className="text-muted-foreground whitespace-pre-wrap">{section.body.slice(0, 500)}{section.body.length > 500 ? "…" : ""}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {(document.claims?.filter((c) => c.flagged).length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Flagged claims</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {document.claims?.filter((c) => c.flagged).map((c) => (
                  <p key={c.id} className="text-amber-700">{c.classification}: {c.claimText.slice(0, 120)}</p>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {mode === "history" && history && (
        <Card>
          <CardHeader><CardTitle className="text-base">Version history</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {((history.versions as Array<Record<string, unknown>>) ?? []).map((v) => (
              <div key={String(v.id)} className="rounded border p-2">
                v{String(v.versionNumber)} · {String(v.status)} · {String(v.createdAt)}
              </div>
            ))}
            <p className="text-muted-foreground mt-4">Generation runs: {((history.generationRuns as unknown[]) ?? []).length}</p>
          </CardContent>
        </Card>
      )}

      {mode === "review" && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">SEO assistance</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {reviewSummary?.seoReport ? (
                <>
                  <p>Word count: {reviewSummary.seoReport.contentLength?.words ?? 0} ({reviewSummary.seoReport.contentLength?.status})</p>
                  <p>Unsupported claims: {reviewSummary.seoReport.unsupportedClaims ?? 0}</p>
                  <p>Missing brief headings: {(reviewSummary.seoReport.briefCoverage?.missing ?? []).join(", ") || "none"}</p>
                  {(reviewSummary.seoReport.notes ?? []).map((n) => <p key={n} className="text-muted-foreground">{n}</p>)}
                </>
              ) : (
                <p className="text-muted-foreground">Loading SEO report…</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Compliance findings</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(reviewSummary?.compliance?.findings ?? []).length === 0 ? (
                <p className="text-muted-foreground">No compliance issues detected.</p>
              ) : (
                (reviewSummary?.compliance?.findings as Array<{ message: string; severity: string }>).map((f, i) => (
                  <p key={i} className={f.severity === "BLOCKING" ? "text-red-700" : "text-amber-700"}>{f.message}</p>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
