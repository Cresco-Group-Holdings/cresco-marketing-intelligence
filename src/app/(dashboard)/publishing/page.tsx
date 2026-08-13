"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api/client";
import { PublicationComposer } from "@/components/publishing/publication-composer";

type PublicationView = {
  id: string;
  contentItemId: string;
  providerKey: string;
  operationType: string;
  status: string;
  scheduledFor: string | null;
  timezone: string;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  providerPermalink: string | null;
  createdAt: string;
};

function statusVariant(status: string): "default" | "muted" | "warning" {
  if (status === "PUBLISHED" || status === "APPROVED") return "default";
  if (status === "FAILED" || status === "PENDING_APPROVAL" || status === "PARTIALLY_PUBLISHED") return "warning";
  return "muted";
}

export default function PublishingPage() {
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;
  const [publications, setPublications] = useState<PublicationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadPublications = useCallback(async () => {
    if (!organisationId || !brandId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ publications: PublicationView[] }>(
        `/api/brands/${brandId}/publications?organisationId=${organisationId}`,
        { organisationId },
      );
      setPublications(data.publications);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load publications.");
    } finally {
      setLoading(false);
    }
  }, [organisationId, brandId]);

  useEffect(() => {
    void loadPublications();
  }, [loadPublications]);

  async function runAction(publicationId: string, action: "approve" | "execute" | "validate" | "retry" | "cancel") {
    if (!organisationId || !brandId) return;
    setActionLoading(`${publicationId}:${action}`);
    setError(null);
    try {
      const path =
        action === "cancel"
          ? `/api/brands/${brandId}/publications/${publicationId}?organisationId=${organisationId}`
          : `/api/brands/${brandId}/publications/${publicationId}/${action}?organisationId=${organisationId}`;
      await apiFetch(path, {
        method: "POST",
        organisationId,
        body: action === "cancel" ? JSON.stringify({ action: "cancel" }) : undefined,
      });
      await loadPublications();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} publication.`);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Publishing"
        description="Governed outbound provider operations with approval, validation, and audit trails."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Publishing" }]}
      />

      {!brandId ? (
        <Card>
          <CardHeader>
            <CardTitle>Select a brand</CardTitle>
            <CardDescription>Publications are brand-scoped. Choose a brand to manage the queue.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <PublicationComposer brandId={brandId} organisationId={organisationId} onCreated={() => void loadPublications()} />

        <Card>
          <CardHeader>
            <CardTitle>Publication queue</CardTitle>
            <CardDescription>Pending, scheduled, and recent outbound operations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <p className="text-sm text-muted-foreground">Loading queue...</p> : null}
            {!loading && publications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No publications yet. Create one using the composer.</p>
            ) : null}
            {publications.map((publication) => (
              <div key={publication.id} className="rounded-md border p-3 text-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(publication.status)}>{publication.status}</Badge>
                  <span className="font-medium">{publication.operationType.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">{publication.providerKey}</span>
                </div>
                <p className="text-muted-foreground">
                  Content {publication.contentItemId.slice(0, 8)}…
                  {publication.scheduledFor ? ` · Scheduled ${publication.scheduledFor}` : ""}
                </p>
                {publication.lastErrorMessage ? (
                  <p className="mt-1 text-amber-700">
                    {publication.lastErrorCode}: {publication.lastErrorMessage}
                  </p>
                ) : null}
                {publication.providerPermalink ? (
                  <a
                    href={publication.providerPermalink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-blue-600 hover:underline"
                  >
                    View on provider
                  </a>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {publication.status === "PENDING_APPROVAL" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading !== null}
                      onClick={() => void runAction(publication.id, "approve")}
                    >
                      Approve
                    </Button>
                  ) : null}
                  {["APPROVED", "SCHEDULED", "QUEUED"].includes(publication.status) ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading !== null}
                        onClick={() => void runAction(publication.id, "validate")}
                      >
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        disabled={actionLoading !== null}
                        onClick={() => void runAction(publication.id, "execute")}
                      >
                        Execute
                      </Button>
                    </>
                  ) : null}
                  {publication.status === "FAILED" || publication.status === "PARTIALLY_PUBLISHED" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading !== null}
                      onClick={() => void runAction(publication.id, "retry")}
                    >
                      Retry
                    </Button>
                  ) : null}
                  {["PENDING_APPROVAL", "APPROVED", "SCHEDULED", "QUEUED"].includes(publication.status) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={actionLoading !== null}
                      onClick={() => void runAction(publication.id, "cancel")}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
