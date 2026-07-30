"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api/client";

type ContentItem = {
  id: string;
  title: string;
  contentType: string;
  status: string;
  priority: string;
  campaignName: string | null;
  updatedAt: string;
  variants: Array<{ provider: string; format: string }>;
};

const WORKFLOW_COLUMNS = [
  "IDEA",
  "DRAFT",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
] as const;

function statusVariant(status: string): "default" | "muted" | "warning" {
  if (status === "APPROVED" || status === "PUBLISHED") return "default";
  if (status === "IN_REVIEW" || status === "CHANGES_REQUESTED" || status === "FAILED") {
    return "warning";
  }
  return "muted";
}

export default function ContentPage() {
  const { preference } = useWorkspace();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [view, setView] = useState<"table" | "cards" | "workflow">("table");
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
      const data = await apiFetch<{ items: ContentItem[] }>(
        `/api/brands/${brandId}/content?${query.toString()}`,
        { organisationId },
      );
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content.");
    } finally {
      setLoading(false);
    }
  }, [organisationId, brandId, statusFilter]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const workflowGroups = useMemo(() => {
    const groups = new Map<string, ContentItem[]>();
    for (const column of WORKFLOW_COLUMNS) groups.set(column, []);
    for (const item of items) {
      const list = groups.get(item.status) ?? [];
      list.push(item);
      groups.set(item.status, list);
    }
    return groups;
  }, [items]);

  return (
    <>
      <PageHeader
        title="Content Studio"
        description="Create, review, and approve social content across platforms."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Content Studio" }]}
        actions={
          brandId ? (
            <div className="flex gap-2">
              <Link
                href="/content/long-form"
                className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-slate-50"
              >
                Long-form SEO
              </Link>
              <Link
                href="/content/new"
                className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
              >
                New content
              </Link>
            </div>
          ) : undefined
        }
      />

      {!brandId ? (
        <Card>
          <CardHeader>
            <CardTitle>Select a brand</CardTitle>
            <CardDescription>Content is brand-scoped. Choose a brand in the workspace header.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant={view === "table" ? "primary" : "outline"} size="sm" onClick={() => setView("table")}>
          Table
        </Button>
        <Button variant={view === "cards" ? "primary" : "outline"} size="sm" onClick={() => setView("cards")}>
          Cards
        </Button>
        <Button variant={view === "workflow" ? "primary" : "outline"} size="sm" onClick={() => setView("workflow")}>
          Workflow
        </Button>
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">All statuses</option>
          {WORKFLOW_COLUMNS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {loading ? <p className="text-sm text-slate-600">Loading content...</p> : null}

      {view === "workflow" ? (
        <div className="grid gap-4 lg:grid-cols-5">
          {WORKFLOW_COLUMNS.map((column) => (
            <Card key={column}>
              <CardHeader>
                <CardTitle className="text-sm">{column.replace(/_/g, " ")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(workflowGroups.get(column) ?? []).map((item) => (
                  <Link
                    key={item.id}
                    href={`/content/${item.id}`}
                    className="block rounded-md border p-3 text-sm hover:bg-slate-50"
                  >
                    <p className="font-medium">{item.title}</p>
                    <p className="text-slate-600">{item.contentType}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {view === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">
                    <Link href={`/content/${item.id}`}>{item.title}</Link>
                  </CardTitle>
                  <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                </div>
                <CardDescription>{item.campaignName ?? item.contentType}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                {item.variants.length} variant{item.variants.length === 1 ? "" : "s"}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {view === "table" ? (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Variants</th>
                  <th className="px-3 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-3 py-3">
                      <Link href={`/content/${item.id}`} className="font-medium hover:underline">
                        {item.title}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{item.contentType}</td>
                    <td className="px-3 py-3">
                      <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                    </td>
                    <td className="px-3 py-3">{item.variants.map((v) => v.provider).join(", ")}</td>
                    <td className="px-3 py-3">{new Date(item.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
