"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api/client";
import { PublicationComposer } from "@/components/publishing/publication-composer";
import {
  publicationStatusLabel,
  publicationStatusVariant,
} from "@/lib/publishing/publication-status-labels";

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
  externalPublicationId: string | null;
  publishedAt: string | null;
  createdAt: string;
};

type PublicationMetrics = {
  metrics: Array<{ key: string; value: number; period: string; measuredAt: string }>;
  awaitingProviderData: boolean;
  sync: { status: string; lastSyncedAt: string | null } | null;
};

function statusBadgeVariant(status: string): "default" | "muted" | "warning" {
  const variant = publicationStatusVariant(status);
  if (variant === "success") return "default";
  if (variant === "warning") return "warning";
  return "muted";
}

export default function PublishingPage() {
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;
  const [publications, setPublications] = useState<PublicationView[]>([]);
  const [metricsByPublication, setMetricsByPublication] = useState<Record<string, PublicationMetrics>>({});
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

      const published = data.publications.filter((row) => row.status === "PUBLISHED");
      const metricEntries = await Promise.all(
        published.slice(0, 10).map(async (publication) => {
          try {
            const metrics = await apiFetch<PublicationMetrics>(
              `/api/brands/${brandId}/publications/${publication.id}/metrics?organisationId=${organisationId}`,
              { organisationId },
            );
            return [publication.id, metrics] as const;
          } catch {
            return [publication.id, null] as const;
          }
        }),
      );
      setMetricsByPublication(
        Object.fromEntries(metricEntries.filter((entry) => entry[1] !== null)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load publications.");
    } finally {
      setLoading(false);
    }
  }, [organisationId, brandId]);

  useEffect(() => {
    void loadPublications();
  }, [loadPublications]);

  async function runAction(publicationId: string, action: "approve" | "execute" | "validate" | "retry" | "cancel" | "sync-metrics") {
    if (!organisationId || !brandId) return;
    setActionLoading(`${publicationId}:${action}`);
    setError(null);
    try {
      const path =
        action === "cancel"
          ? `/api/brands/${brandId}/publications/${publicationId}?organisationId=${organisationId}`
          : action === "sync-metrics"
            ? `/api/brands/${brandId}/publications/${publicationId}/metrics/sync?organisationId=${organisationId}`
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
        description="Organic social publishing queue with real provider execution, scheduling, and performance sync."
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
            <CardTitle>Publishing history</CardTitle>
            <CardDescription>Real publication records from the canonical ProviderConnection path.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <p className="text-sm text-muted-foreground">Loading queue...</p> : null}
            {!loading && publications.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No publications yet. Approve content in Content Studio and publish via Instagram.
              </p>
            ) : null}
            {publications.map((publication) => {
              const metrics = metricsByPublication[publication.id];
              return (
              <div key={publication.id} className="rounded-md border p-3 text-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant={statusBadgeVariant(publication.status)}>
                    {publicationStatusLabel(publication.status)}
                  </Badge>
                  <span className="font-medium">{publication.operationType.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">{publication.providerKey}</span>
                </div>
                <p className="text-muted-foreground">
                  Content {publication.contentItemId.slice(0, 8)}…
                  {publication.scheduledFor
                    ? ` · Scheduled ${new Date(publication.scheduledFor).toLocaleString()} (${publication.timezone})`
                    : ""}
                  {publication.publishedAt
                    ? ` · Published ${new Date(publication.publishedAt).toLocaleString()}`
                    : ""}
                </p>
                {publication.externalPublicationId ? (
                  <p className="text-xs text-muted-foreground">
                    External ID {publication.externalPublicationId}
                  </p>
                ) : null}
                {publication.lastErrorMessage ? (
                  <p className="mt-1 text-amber-700">
                    {publication.lastErrorCode}: {publication.lastErrorMessage}
                    {publication.status === "REQUIRES_REAUTH" ? " · Reconnect in Integrations." : ""}
                  </p>
                ) : null}
                {publication.providerPermalink ? (
                  <a
                    href={publication.providerPermalink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-blue-600 hover:underline"
                  >
                    View on Instagram
                  </a>
                ) : null}
                {metrics ? (
                  <div className="mt-2 rounded bg-muted/30 p-2 text-xs">
                    {metrics.awaitingProviderData ? (
                      <p>Awaiting provider metrics…</p>
                    ) : (
                      <p>
                        {metrics.metrics
                          .slice(0, 6)
                          .map((m) => `${m.key}: ${m.value}`)
                          .join(" · ") || "No metrics yet"}
                      </p>
                    )}
                    {metrics.sync?.lastSyncedAt ? (
                      <p className="text-muted-foreground">
                        Last sync {new Date(metrics.sync.lastSyncedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
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
                  {publication.status === "FAILED" ||
                  publication.status === "PARTIALLY_PUBLISHED" ||
                  publication.status === "REQUIRES_REAUTH" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading !== null}
                      onClick={() => void runAction(publication.id, "retry")}
                    >
                      Retry
                    </Button>
                  ) : null}
                  {publication.status === "PUBLISHED" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading !== null}
                      onClick={() => void runAction(publication.id, "sync-metrics")}
                    >
                      Refresh metrics
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
            );
            })}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
