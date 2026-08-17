"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

export default function ReviewContentPage() {
  const params = useParams<{ contentId: string }>();
  const { preference } = useWorkspace();
  const [item, setItem] = useState<{ title: string; status: string } | null>(null);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;
  const contentId = params.contentId;

  const loadItem = useCallback(async () => {
    if (!organisationId || !brandId) return;
    const data = await apiFetch<{ item: { title: string; status: string } }>(
      `/api/brands/${brandId}/content/${contentId}?organisationId=${organisationId}`,
      { organisationId },
    );
    setItem(data.item);
  }, [organisationId, brandId, contentId]);

  useEffect(() => {
    void loadItem();
  }, [loadItem]);

  async function approve() {
    if (!organisationId || !brandId) return;
    await apiFetch(
      `/api/brands/${brandId}/content/${contentId}/approve?organisationId=${organisationId}`,
      { method: "POST", organisationId, body: JSON.stringify({}) },
    );
    setMessage("Content approved.");
    await loadItem();
  }

  async function requestChanges() {
    if (!organisationId || !brandId || !comment.trim()) return;
    await apiFetch(
      `/api/brands/${brandId}/content/${contentId}/request-changes?organisationId=${organisationId}`,
      { method: "POST", organisationId, body: JSON.stringify({ decisionNote: comment }) },
    );
    setMessage("Changes requested.");
    await loadItem();
  }

  async function addComment() {
    if (!organisationId || !brandId || !comment.trim()) return;
    await apiFetch(
      `/api/brands/${brandId}/content/${contentId}/comments?organisationId=${organisationId}`,
      { method: "POST", organisationId, body: JSON.stringify({ body: comment }) },
    );
    setComment("");
    setMessage("Comment added.");
  }

  if (!item) return <p className="text-sm text-foreground-muted">Loading review...</p>;

  return (
    <>
      <PageHeader
        title={`Review: ${item.title}`}
        description="Approve content, request changes, or leave review comments."
        breadcrumbs={[
          { label: "Content Studio", href: "/content" },
          { label: item.title, href: `/content/${contentId}` },
          { label: "Review" },
        ]}
      />
      {message ? <p className="mb-4 text-sm text-green-700">{message}</p> : null}
      <Card>
        <CardHeader>
          <CardTitle>Review actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground-muted">Current status: {item.status}</p>
          <textarea
            className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Review comment or change request note"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void approve()} disabled={item.status !== "IN_REVIEW"}>
              Approve
            </Button>
            <Button variant="outline" onClick={() => void requestChanges()} disabled={item.status !== "IN_REVIEW"}>
              Request changes
            </Button>
            <Button variant="outline" onClick={() => void addComment()}>
              Add comment
            </Button>
            <Link href={`/content/${contentId}/history`} className="inline-flex h-9 items-center px-3 text-sm">
              View history
            </Link>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
