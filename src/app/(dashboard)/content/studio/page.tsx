"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import {
  ContentStudioPipeline,
  type StudioListItem,
} from "@/components/content-studio/content-studio-pipeline";

export default function ContentStudioPage() {
  const { preference } = useWorkspace();
  const [items, setItems] = useState<StudioListItem[]>([]);
  const [view, setView] = useState<"list" | "pipeline">("pipeline");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;

  const loadItems = useCallback(async () => {
    if (!organisationId || !brandId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ organisationId });
      if (statusFilter) query.set("status", statusFilter);
      const data = await apiFetch<{ items: StudioListItem[] }>(
        `/api/brands/${brandId}/content-studio?${query.toString()}`,
        { organisationId },
      );
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content studio items.");
    } finally {
      setLoading(false);
    }
  }, [organisationId, brandId, statusFilter]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Studio"
        description="Manage content briefs, drafts, reviews, and publication readiness."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/content">Legacy content</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/content/studio/new">New content</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={view === "pipeline" ? "default" : "outline"}
          onClick={() => setView("pipeline")}
        >
          Pipeline
        </Button>
        <Button
          size="sm"
          variant={view === "list" ? "default" : "outline"}
          onClick={() => setView("list")}
        >
          List
        </Button>
        <select
          className="rounded-md border px-2 py-1 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="IDEA">Idea</option>
          <option value="BRIEF">Brief</option>
          <option value="DRAFT">Draft</option>
          <option value="IN_REVIEW">In review</option>
          <option value="APPROVED">Approved</option>
          <option value="READY">Ready</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="PUBLISHED">Published</option>
        </select>
      </div>

      {loading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="py-8 text-center text-destructive">{error}</CardContent>
        </Card>
      )}

      {!loading && !error && items.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No content studio items yet.</p>
            <Button className="mt-4" size="sm" asChild>
              <Link href="/content/studio/new">Create your first content</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && items.length > 0 && view === "pipeline" && brandId && (
        <ContentStudioPipeline items={items} brandId={brandId} />
      )}

      {!loading && !error && items.length > 0 && view === "list" && (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/content/studio/${item.id}`}
              className="block rounded-md border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.studioType?.replace(/_/g, " ")} · v{item.version}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {item.status.replace(/_/g, " ")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
