"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import {
  KNOWLEDGE_ENTRY_STATUS_LABELS,
  KNOWLEDGE_ENTRY_TYPE_LABELS,
} from "@/lib/knowledge-base/constants";

type EntryDetail = {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  content: string;
  status: string;
  version: number;
  sourceType: string;
  sourceReference: string | null;
  validFrom: string | null;
  validUntil: string | null;
  createdBy: { displayName: string | null; email: string };
  approvedBy: { displayName: string | null; email: string } | null;
};

type Version = {
  id: string;
  version: number;
  title: string;
  changeNote: string | null;
  createdAt: string;
  changedBy: { displayName: string | null; email: string };
};

type Activity = {
  id: string;
  action: string;
  createdAt: string;
  actor: { displayName: string | null; email: string };
};

type Relationship = {
  id: string;
  relationshipType: string;
  sourceEntry: { id: string; title: string };
  targetEntry: { id: string; title: string };
};

export default function KnowledgeEntryDetailPage() {
  const params = useParams<{ brandId: string; knowledgeBaseId: string; entryId: string }>();
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;

  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [conflicts, setConflicts] = useState<Relationship[]>([]);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { brandId, knowledgeBaseId, entryId } = params;

  const load = useCallback(async () => {
    if (!organisationId) return;
    setLoading(true);
    setError(null);
    try {
      const [entryRes, versionsRes, activityRes, relationshipsRes] = await Promise.all([
        apiFetch<{ entry: EntryDetail }>(
          `/api/brands/${brandId}/knowledge-bases/${knowledgeBaseId}/entries/${entryId}`,
          { organisationId },
        ),
        apiFetch<{ versions: Version[] }>(
          `/api/brands/${brandId}/knowledge-bases/${knowledgeBaseId}/entries/${entryId}/versions`,
          { organisationId },
        ),
        apiFetch<{ activity: Activity[] }>(
          `/api/brands/${brandId}/knowledge-bases/${knowledgeBaseId}/entries/${entryId}/activity`,
          { organisationId },
        ),
        apiFetch<{ relationships: Relationship[]; conflicts: Relationship[] }>(
          `/api/brands/${brandId}/knowledge-bases/${knowledgeBaseId}/entries/${entryId}/relationships`,
          { organisationId },
        ),
      ]);
      setEntry(entryRes.entry);
      setEditTitle(entryRes.entry.title);
      setEditContent(entryRes.entry.content);
      setVersions(versionsRes.versions);
      setActivity(activityRes.activity);
      setRelationships(relationshipsRes.relationships);
      setConflicts(relationshipsRes.conflicts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entry.");
    } finally {
      setLoading(false);
    }
  }, [brandId, entryId, knowledgeBaseId, organisationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(action: string, body?: Record<string, unknown>) {
    if (!organisationId || !entry) return;
    setError(null);
    setMessage(null);
    try {
      await apiFetch(
        `/api/brands/${brandId}/knowledge-bases/${knowledgeBaseId}/entries/${entryId}?action=${action}`,
        {
          method: "POST",
          organisationId,
          body: body ? JSON.stringify(body) : undefined,
        },
      );
      setMessage(`Action ${action} completed.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} entry.`);
    }
  }

  async function saveEdit() {
    if (!organisationId || !entry) return;
    setError(null);
    try {
      await apiFetch(
        `/api/brands/${brandId}/knowledge-bases/${knowledgeBaseId}/entries/${entryId}`,
        {
          method: "PUT",
          organisationId,
          body: JSON.stringify({
            title: editTitle,
            content: editContent,
            expectedVersion: entry.version,
            changeNote,
          }),
        },
      );
      setMessage("Entry updated.");
      setChangeNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update entry.");
    }
  }

  if (!organisationId) {
    return <p className="text-sm text-slate-600">Select an organisation to view this entry.</p>;
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading entry…</p>;
  }

  if (!entry) {
    return <p className="text-sm text-red-600">{error ?? "Entry not found."}</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={entry.title}
        description={`${KNOWLEDGE_ENTRY_TYPE_LABELS[entry.type]} · ${KNOWLEDGE_ENTRY_STATUS_LABELS[entry.status]} · v${entry.version}`}
        actions={
          <ButtonLink variant="outline" href={`/brands/${brandId}/knowledge-bases`}>
            Back to list
          </ButtonLink>
        }
      />

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}
      {message ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-3 text-sm text-emerald-700">{message}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input label="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              <textarea
                className="min-h-48 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
              <Input
                label="Change note"
                placeholder="Change note (optional)"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void saveEdit()}>Save new version</Button>
                {entry.status === "DRAFT" || entry.status === "REJECTED" ? (
                  <Button variant="outline" onClick={() => void runAction("submit")}>
                    Submit for review
                  </Button>
                ) : null}
                {entry.status === "IN_REVIEW" ? (
                  <>
                    <Button variant="outline" onClick={() => void runAction("approve")}>
                      Approve
                    </Button>
                    <Input
                      label="Rejection reason"
                      placeholder="Rejection reason"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      onClick={() => void runAction("reject", { reason: rejectReason })}
                    >
                      Reject
                    </Button>
                  </>
                ) : null}
                {entry.status !== "ARCHIVED" ? (
                  <Button variant="outline" onClick={() => void runAction("archive")}>
                    Archive
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => void runAction("restore")}>
                    Restore
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {conflicts.length > 0 ? (
            <Card className="border-amber-200">
              <CardHeader>
                <CardTitle>Conflicts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {conflicts.map((rel) => (
                  <p key={rel.id}>
                    Conflicts with:{" "}
                    {rel.sourceEntry.id === entryId ? rel.targetEntry.title : rel.sourceEntry.title}
                  </p>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p>Source: {entry.sourceType}</p>
              {entry.sourceReference ? <p>Reference: {entry.sourceReference}</p> : null}
              <p>Created by: {entry.createdBy.displayName ?? entry.createdBy.email}</p>
              {entry.approvedBy ? (
                <p>Approved by: {entry.approvedBy.displayName ?? entry.approvedBy.email}</p>
              ) : null}
              {entry.validFrom ? <p>Valid from: {new Date(entry.validFrom).toLocaleDateString()}</p> : null}
              {entry.validUntil ? <p>Valid until: {new Date(entry.validUntil).toLocaleDateString()}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revision history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {versions.map((version) => (
                <div key={version.id} className="rounded border px-3 py-2">
                  <p className="font-medium">
                    v{version.version} — {version.title}
                  </p>
                  <p className="text-slate-500">
                    {version.changedBy.displayName ?? version.changedBy.email} ·{" "}
                    {new Date(version.createdAt).toLocaleString()}
                  </p>
                  {version.changeNote ? <p className="text-slate-600">{version.changeNote}</p> : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {activity.length === 0 ? (
                <p className="text-slate-500">No activity recorded.</p>
              ) : (
                activity.map((item) => (
                  <p key={item.id}>
                    {item.action} · {item.actor.displayName ?? item.actor.email} ·{" "}
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Relationships</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {relationships.length === 0 ? (
                <p className="text-slate-500">No relationships defined.</p>
              ) : (
                relationships.map((rel) => (
                  <p key={rel.id}>
                    {rel.relationshipType}:{" "}
                    {rel.sourceEntry.id === entryId ? rel.targetEntry.title : rel.sourceEntry.title}
                  </p>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
