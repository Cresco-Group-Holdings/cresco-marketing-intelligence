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
import { TikTokPublishPanel } from "@/components/publishing/tiktok-publish-panel";
import { LinkedInFacebookPublishPanel } from "@/components/publishing/linkedin-facebook-publish-panel";
import { YouTubeXPublishPanel } from "@/components/publishing/youtube-x-publish-panel";

type ContentDetail = {
  id: string;
  title: string;
  status: string;
  contentType: string;
  primaryMessage: string | null;
  variants: Array<{
    id: string;
    provider: string;
    socialAccountId: string | null;
    format: string;
    caption: string | null;
    headline?: string | null;
    destinationUrl?: string | null;
    socialAccount: {
      providerAccountId: string;
      accountType: string;
      displayName: string | null;
      username: string | null;
    } | null;
  }>;
  complianceChecks: Array<{
    checkType: string;
    result: string;
    message: string;
    blocking: boolean;
  }>;
  provenance: {
    aiProvider?: string | null;
    aiModel?: string | null;
    generatedAt?: string | null;
    metadata?: {
      estimatedCostUsd?: number;
      safetyFlags?: Array<{ message: string; requiresReview: boolean }>;
    } | null;
  } | null;
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
  async function publishInstagram() {
    const variant = item?.variants.find(
      (entry) => entry.provider === "INSTAGRAM" && entry.socialAccountId,
    );
    if (!organisationId || !brandId || !variant) return;
    const confirmed = window.confirm(
      `Publish this approved content to the selected Instagram account now?\n\nCaption: ${variant.caption ?? ""}`,
    );
    if (!confirmed) return;
    await apiFetch(
      `/api/brands/${brandId}/content/${contentId}/instagram-publish?organisationId=${organisationId}`,
      {
        method: "POST",
        organisationId,
        body: JSON.stringify({
          contentVariantId: variant.id,
          socialAccountId: variant.socialAccountId,
          confirmed: true,
          idempotencyKey: crypto.randomUUID(),
        }),
      },
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
        breadcrumbs={[{ label: "Content Studio", href: "/content" }, { label: item.title }]}
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
        {item.status === "APPROVED" &&
        item.variants.some(
          (variant) => variant.provider === "INSTAGRAM" && variant.socialAccountId,
        ) ? (
          <Button size="sm" onClick={() => void publishInstagram()}>
            Confirm & publish to Instagram
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

        {item.status === "APPROVED" && organisationId && brandId
          ? item.variants
              .filter((variant) => variant.provider === "TIKTOK" && variant.socialAccountId)
              .map((variant) => (
                <div key={variant.id} className="lg:col-span-2">
                  <TikTokPublishPanel
                    brandId={brandId}
                    organisationId={organisationId}
                    contentId={contentId}
                    contentVariantId={variant.id}
                  />
                </div>
              ))
          : null}

        {item.status === "APPROVED" && organisationId && brandId
          ? item.variants
              .filter(
                (variant) =>
                  (variant.provider === "LINKEDIN" || variant.provider === "FACEBOOK") &&
                  variant.socialAccountId &&
                  variant.socialAccount,
              )
              .map((variant) => (
                <div key={`publish-${variant.id}`} className="lg:col-span-2">
                  <LinkedInFacebookPublishPanel
                    brandId={brandId}
                    organisationId={organisationId}
                    contentId={contentId}
                    variant={{
                      ...variant,
                      provider: variant.provider as "LINKEDIN" | "FACEBOOK",
                      socialAccountId: variant.socialAccountId!,
                      socialAccount: variant.socialAccount!,
                    }}
                  />
                </div>
              ))
          : null}

        {item.status === "APPROVED" && organisationId && brandId
          ? item.variants
              .filter(
                (variant) =>
                  (variant.provider === "YOUTUBE" || variant.provider === "X") &&
                  variant.socialAccountId &&
                  variant.socialAccount,
              )
              .map((variant) => (
                <div key={`publish-${variant.id}`} className="lg:col-span-2">
                  <YouTubeXPublishPanel
                    brandId={brandId}
                    organisationId={organisationId}
                    contentId={contentId}
                    variant={{
                      ...variant,
                      provider: variant.provider as "YOUTUBE" | "X",
                      socialAccountId: variant.socialAccountId!,
                      socialAccount: variant.socialAccount!,
                    }}
                  />
                </div>
              ))
          : null}

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
                  <p className={check.blocking ? "text-red-700" : "text-slate-600"}>
                    {check.message}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        {item.provenance?.aiProvider ? (
          <Card>
            <CardHeader>
              <CardTitle>AI generation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                {item.provenance.aiProvider} · {item.provenance.aiModel}
              </p>
              <p className="text-slate-600">
                Estimated cost: ${item.provenance.metadata?.estimatedCostUsd ?? 0}
              </p>
              <p className="text-slate-600">
                Generated content remains a draft and requires review before approval.
              </p>
              {(item.provenance.metadata?.safetyFlags?.length ?? 0) > 0 ? (
                <p className="text-amber-700">
                  Manual review flagged:{" "}
                  {item.provenance.metadata?.safetyFlags?.map((flag) => flag.message).join(" ")}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
