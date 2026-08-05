"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import {
  KNOWLEDGE_ENTRY_STATUS_LABELS,
  KNOWLEDGE_ENTRY_TYPE_LABELS,
} from "@/lib/knowledge-base/constants";

type KnowledgeBase = {
  id: string;
  name: string;
  description: string | null;
  _count?: { entries: number; documents: number };
};

type KnowledgeEntry = {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  status: string;
  version: number;
  sourceType: string;
  updatedAt: string;
  validFrom: string | null;
  validUntil: string | null;
};

type KnowledgeDocument = {
  id: string;
  title: string;
  filename: string;
  mimeType: string;
  status: string;
  fileSizeBytes: number;
  createdAt: string;
};

const ENTRY_TYPES = Object.keys(KNOWLEDGE_ENTRY_TYPE_LABELS);
const ENTRY_STATUSES = Object.keys(KNOWLEDGE_ENTRY_STATUS_LABELS);

type View = "entries" | "approval" | "documents" | "create";

export function KnowledgeBaseView() {
  const params = useParams<{ brandId: string; knowledgeBaseId?: string }>();
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;

  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [activeKbId, setActiveKbId] = useState<string | null>(params.knowledgeBaseId ?? null);
  const [view, setView] = useState<View>("entries");
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<KnowledgeEntry[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newEntry, setNewEntry] = useState({
    type: "GENERAL",
    title: "",
    summary: "",
    content: "",
  });

  const brandId = params.brandId;

  const loadBases = useCallback(async () => {
    if (!organisationId) return;
    const data = await apiFetch<{ knowledgeBases: KnowledgeBase[] }>(
      `/api/brands/${brandId}/knowledge-bases`,
      { organisationId },
    );
    setKnowledgeBases(data.knowledgeBases);
    if (!activeKbId && data.knowledgeBases[0]) {
      setActiveKbId(data.knowledgeBases[0].id);
    }
  }, [activeKbId, brandId, organisationId]);

  const loadEntries = useCallback(async () => {
    if (!organisationId || !activeKbId) return;
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (typeFilter) query.set("type", typeFilter);
    if (statusFilter) query.set("status", statusFilter);
    const data = await apiFetch<{ entries: KnowledgeEntry[] }>(
      `/api/brands/${brandId}/knowledge-bases/${activeKbId}/entries?${query.toString()}`,
      { organisationId },
    );
    setEntries(data.entries);
  }, [activeKbId, brandId, organisationId, search, statusFilter, typeFilter]);

  const loadDocuments = useCallback(async () => {
    if (!organisationId || !activeKbId) return;
    const data = await apiFetch<{ documents: KnowledgeDocument[] }>(
      `/api/brands/${brandId}/knowledge-bases/${activeKbId}/documents`,
      { organisationId },
    );
    setDocuments(data.documents);
  }, [activeKbId, brandId, organisationId]);

  const loadApprovalQueue = useCallback(async () => {
    if (!organisationId || !activeKbId) return;
    const data = await apiFetch<{ queue: KnowledgeEntry[] }>(
      `/api/brands/${brandId}/knowledge-bases/${activeKbId}/approval-queue`,
      { organisationId },
    );
    setApprovalQueue(data.queue);
  }, [activeKbId, brandId, organisationId]);

  const refresh = useCallback(async () => {
    if (!organisationId) return;
    setLoading(true);
    setError(null);
    try {
      await loadBases();
      await Promise.all([loadEntries(), loadDocuments(), loadApprovalQueue()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load knowledge base.");
    } finally {
      setLoading(false);
    }
  }, [loadApprovalQueue, loadBases, loadDocuments, loadEntries, organisationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeBase = useMemo(
    () => knowledgeBases.find((kb) => kb.id === activeKbId) ?? null,
    [activeKbId, knowledgeBases],
  );

  async function handleCreateEntry() {
    if (!organisationId || !activeKbId) return;
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/brands/${brandId}/knowledge-bases/${activeKbId}/entries`, {
        method: "POST",
        organisationId,
        body: JSON.stringify(newEntry),
      });
      setMessage("Entry created as draft.");
      setNewEntry({ type: "GENERAL", title: "", summary: "", content: "" });
      setView("entries");
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create entry.");
    }
  }

  async function handleUploadDocument(file: File) {
    if (!organisationId || !activeKbId) return;
    const formData = new FormData();
    formData.append("file", file);
    setError(null);
    try {
      const headers: HeadersInit = {};
      if (organisationId) headers["x-organisation-id"] = organisationId;
      const response = await fetch(
        `/api/brands/${brandId}/knowledge-bases/${activeKbId}/documents`,
        { method: "POST", body: formData, headers },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Upload failed.");
      }
      setMessage("Document uploaded.");
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload document.");
    }
  }

  if (!organisationId) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-slate-600">
          Select an organisation to manage the knowledge base.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base"
        description="Versioned, approved brand intelligence for AI and content modules."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/brands/${brandId}/knowledge`}>Structured profile</Link>
            </Button>
            <Button onClick={() => setView("create")}>New entry</Button>
          </div>
        }
      />

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}
      {message ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-4 text-sm text-emerald-700">{message}</CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {knowledgeBases.map((kb) => (
          <Button
            key={kb.id}
            variant={kb.id === activeKbId ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveKbId(kb.id)}
          >
            {kb.name}
          </Button>
        ))}
      </div>

      {activeBase ? (
        <Card>
          <CardHeader>
            <CardTitle>{activeBase.name}</CardTitle>
            <CardDescription>
              {activeBase.description ?? "Approved knowledge entries and supporting documents."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(["entries", "approval", "documents", "create"] as View[]).map((tab) => (
                <Button
                  key={tab}
                  size="sm"
                  variant={view === tab ? "default" : "outline"}
                  onClick={() => setView(tab)}
                >
                  {tab === "entries" && "Entries"}
                  {tab === "approval" && `Approval (${approvalQueue.length})`}
                  {tab === "documents" && "Documents"}
                  {tab === "create" && "Create"}
                </Button>
              ))}
            </div>

            {loading ? (
              <p className="text-sm text-slate-500">Loading knowledge base…</p>
            ) : null}

            {view === "entries" ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Input
                    placeholder="Search entries"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <select
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                  >
                    <option value="">All types</option>
                    {ENTRY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {KNOWLEDGE_ENTRY_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="">All statuses</option>
                    {ENTRY_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {KNOWLEDGE_ENTRY_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>
                <Button size="sm" variant="outline" onClick={() => void loadEntries()}>
                  Apply filters
                </Button>
                {entries.length === 0 ? (
                  <p className="text-sm text-slate-500">No entries yet. Create your first knowledge entry.</p>
                ) : (
                  <div className="divide-y rounded-lg border">
                    {entries.map((entry) => (
                      <Link
                        key={entry.id}
                        href={`/brands/${brandId}/knowledge-bases/${activeKbId}/entries/${entry.id}`}
                        className="block px-4 py-3 hover:bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-slate-900">{entry.title}</p>
                            <p className="text-sm text-slate-500">
                              {KNOWLEDGE_ENTRY_TYPE_LABELS[entry.type]} · v{entry.version} ·{" "}
                              {KNOWLEDGE_ENTRY_STATUS_LABELS[entry.status]}
                            </p>
                          </div>
                          <span className="text-xs text-slate-400">
                            {new Date(entry.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {view === "approval" ? (
              approvalQueue.length === 0 ? (
                <p className="text-sm text-slate-500">No entries awaiting approval.</p>
              ) : (
                <div className="divide-y rounded-lg border">
                  {approvalQueue.map((entry) => (
                    <Link
                      key={entry.id}
                      href={`/brands/${brandId}/knowledge-bases/${activeKbId}/entries/${entry.id}`}
                      className="block px-4 py-3 hover:bg-slate-50"
                    >
                      <p className="font-medium">{entry.title}</p>
                      <p className="text-sm text-slate-500">
                        {KNOWLEDGE_ENTRY_TYPE_LABELS[entry.type]} · awaiting review
                      </p>
                    </Link>
                  ))}
                </div>
              )
            ) : null}

            {view === "documents" ? (
              <div className="space-y-4">
                <Input
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.doc,.docx"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleUploadDocument(file);
                  }}
                />
                {documents.length === 0 ? (
                  <p className="text-sm text-slate-500">No documents uploaded yet.</p>
                ) : (
                  <div className="divide-y rounded-lg border">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-sm text-slate-500">
                            {doc.filename} · {doc.status} · {(doc.fileSizeBytes / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {view === "create" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 md:col-span-2">
                  <label className="text-sm font-medium">Type</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={newEntry.type}
                    onChange={(event) => setNewEntry((prev) => ({ ...prev, type: event.target.value }))}
                  >
                    {ENTRY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {KNOWLEDGE_ENTRY_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-3 md:col-span-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={newEntry.title}
                    onChange={(event) => setNewEntry((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </div>
                <div className="space-y-3 md:col-span-2">
                  <label className="text-sm font-medium">Summary</label>
                  <Input
                    value={newEntry.summary}
                    onChange={(event) => setNewEntry((prev) => ({ ...prev, summary: event.target.value }))}
                  />
                </div>
                <div className="space-y-3 md:col-span-2">
                  <label className="text-sm font-medium">Content</label>
                  <textarea
                    className="min-h-40 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={newEntry.content}
                    onChange={(event) => setNewEntry((prev) => ({ ...prev, content: event.target.value }))}
                  />
                </div>
                <Button onClick={() => void handleCreateEntry()}>Save draft</Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-sm text-slate-500">
            {loading ? "Loading…" : "No knowledge base found for this brand."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
