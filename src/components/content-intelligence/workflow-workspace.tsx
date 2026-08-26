"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import {
  ContentStudioPipeline,
  type StudioListItem,
} from "@/components/content-studio/content-studio-pipeline";

export function WorkflowWorkspace() {
  const { preference } = useWorkspace();
  const [items, setItems] = useState<StudioListItem[]>([]);
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
      const data = await apiFetch<{ items: StudioListItem[] }>(
        `/api/brands/${brandId}/content-studio?organisationId=${organisationId}`,
        { organisationId },
      );
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }, [organisationId, brandId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const awaitingApproval = items.filter((i) => i.status === "IN_REVIEW").length;
  const overdueDrafts = items.filter(
    (i) => i.dueAt && new Date(i.dueAt) < new Date() && ["DRAFT", "BRIEF"].includes(i.status),
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Workflow"
        description="Track bottlenecks from idea to publication."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {awaitingApproval > 0 ? (
          <Card>
            <CardContent className="py-4 text-sm">
              <p className="font-medium">{awaitingApproval} items awaiting approval</p>
            </CardContent>
          </Card>
        ) : null}
        {overdueDrafts > 0 ? (
          <Card>
            <CardContent className="py-4 text-sm">
              <p className="font-medium">{overdueDrafts} drafts overdue</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No content in workflow.</p>
            <Link href="/content/studio/create" className="mt-2 inline-block text-sm text-primary">
              Create content
            </Link>
          </CardContent>
        </Card>
      ) : brandId ? (
        <ContentStudioPipeline items={items} brandId={brandId} />
      ) : null}
    </div>
  );
}
