"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

type ContentDetail = {
  id: string;
  title: string;
  status: string;
  contentType: string;
  primaryMessage: string | null;
  variants: Array<{ id: string; provider: string; format: string; caption: string | null }>;
  complianceChecks: Array<{ checkType: string; result: string; message: string; blocking: boolean }>;
};

export default function ContentDetailPage() {
  const params = useParams<{ contentId: string }>();
  const { preference } = useWorkspace();
  const [item, setItem] = useState<ContentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;
  const contentId = params.contentId;

  const loadItem = useCallback(async () => {
    if (!organisationId || !brandId) return;
    try {
      const data = await apiFetch<{ item: ContentDetail }>(
        `/api/brands/${brandId}/content/${contentId}?organisationId=${organisationId}`,
        { organisationId },
      );
      setItem(data.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content.");
    }
  }, [organisationId, brandId, contentId]);

  useEffect(() => {
    void loadItem();
  }, [loadItem]);

  async function submitForReview() {
    if (!organisationId || !brandId) return;
    await apiFetch(
      `/api/brands/${brandId}/content/${contentId}/submit-for-review?organisationId=${organisationId}`,
      { method: "POST", organisationId },
    );
    await loadItem();
  }

  if (!item) {
    return <p className="text-sm text-slate-600">{error ?? "Loading content..."}</p>;
  }

  return (
    <>
      <PageHeader
        title={item.title}
        description="Review content details, variants, and compliance findings."
        breadcrumbs={[
          { label: "Content Studio", href: "/content" },
          { label: item.title },
        ]}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge>{item.status}</Badge>
        <Link href={`/content/${contentId}/edit`} className="text-sm underline">
          Edit
        </Link>
        <Link href={`/content/${contentId}/review`} className="text-sm underline">
          Review
        </Link>
        <Link href={`/content/${contentId}/history`} className="text-sm underline">
          History
        </Link>
        {["DRAFT", "CHANGES_REQUESTED", "IDEA"].includes(item.status) ? (
          <Button size="sm" onClick={() => void submitForReview()}>
            Submit for review
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Core message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{item.primaryMessage ?? "No primary message yet."}</p>
            <p className="text-slate-600">Type: {item.contentType}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform variants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {item.variants.map((variant) => (
              <div key={variant.id} className="rounded-md border p-3">
                <p className="font-medium">{variant.provider}</p>
                <p className="text-slate-600">{variant.format}</p>
                <p>{variant.caption}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Compliance checks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {item.complianceChecks.length === 0 ? (
              <p className="text-slate-600">No compliance findings yet.</p>
            ) : (
              item.complianceChecks.map((check, index) => (
                <div key={`${check.checkType}-${index}`} className="rounded-md border p-3">
                  <p className="font-medium">
                    {check.checkType} · {check.result}
                  </p>
                  <p className={check.blocking ? "text-red-700" : "text-slate-600"}>{check.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
