"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

type Revision = {
  id: string;
  revisionNumber: number;
  source: string;
  changeNote: string | null;
  editorUserId: string;
  createdAt: string;
  changedFields: Record<string, unknown>;
};

export default function ContentHistoryPage() {
  const params = useParams<{ contentId: string }>();
  const { preference } = useWorkspace();
  const [revisions, setRevisions] = useState<Revision[]>([]);

  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;
  const contentId = params.contentId;

  const loadRevisions = useCallback(async () => {
    if (!organisationId || !brandId) return;
    const data = await apiFetch<{ revisions: Revision[] }>(
      `/api/brands/${brandId}/content/${contentId}/revisions?organisationId=${organisationId}`,
      { organisationId },
    );
    setRevisions(data.revisions);
  }, [organisationId, brandId, contentId]);

  useEffect(() => {
    void loadRevisions();
  }, [loadRevisions]);

  async function restoreRevision(revisionNumber: number) {
    if (!organisationId || !brandId) return;
    await apiFetch(
      `/api/brands/${brandId}/content/${contentId}/revisions/${revisionNumber}/restore?organisationId=${organisationId}`,
      { method: "POST", organisationId, body: JSON.stringify({}) },
    );
    await loadRevisions();
  }

  return (
    <>
      <PageHeader
        title="Revision history"
        description="Compare revisions and restore prior versions."
        breadcrumbs={[
          { label: "Content Studio", href: "/content" },
          { label: "History" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Revisions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {revisions.length === 0 ? (
            <p className="text-sm text-slate-600">No revisions recorded yet.</p>
          ) : (
            revisions.map((revision) => (
              <div key={revision.id} className="rounded-md border p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Revision {revision.revisionNumber}</p>
                    <p className="text-slate-600">
                      {revision.source} · {new Date(revision.createdAt).toLocaleString()}
                    </p>
                    {revision.changeNote ? <p>{revision.changeNote}</p> : null}
                    <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs">
                      {JSON.stringify(revision.changedFields, null, 2)}
                    </pre>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void restoreRevision(revision.revisionNumber)}>
                    Restore
                  </Button>
                </div>
              </div>
            ))
          )}
          <Link href={`/content/${contentId}`} className="text-sm underline">
            Back to content
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
