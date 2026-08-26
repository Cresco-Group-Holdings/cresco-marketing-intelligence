"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import type { StudioListItem } from "@/components/content-studio/content-studio-pipeline";

export function LibraryWorkspace() {
  const { preference } = useWorkspace();
  const [items, setItems] = useState<StudioListItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;

  const loadItems = useCallback(async () => {
    if (!organisationId || !brandId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const query = new URLSearchParams({ organisationId });
      if (statusFilter) query.set("status", statusFilter);
      if (search) query.set("search", search);
      const data = await apiFetch<{ items: StudioListItem[] }>(
        `/api/brands/${brandId}/content-studio?${query.toString()}`,
        { organisationId },
      );
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }, [organisationId, brandId, statusFilter, search]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Library"
        description="Searchable repository of briefs, drafts, and published content."
        actions={
          <ButtonLink size="sm" href="/content/studio/create">
            Create content
          </ButtonLink>
        }
      />

      <div className="flex flex-wrap gap-2">
        <input
          className="rounded-md border px-3 py-1.5 text-sm"
          placeholder="Search title or theme…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-md border px-2 py-1.5 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="BRIEF">Brief</option>
          <option value="DRAFT">Draft</option>
          <option value="IN_REVIEW">In review</option>
          <option value="PUBLISHED">Published</option>
        </select>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">No content found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/content/studio/${item.id}`}
              className="block rounded-md border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.studioType?.replace(/_/g, " ")} · v{item.version}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">
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
