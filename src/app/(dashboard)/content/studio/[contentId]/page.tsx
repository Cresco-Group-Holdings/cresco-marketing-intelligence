"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import {
  ContentStudioEditor,
  type StudioEditorValues,
} from "@/components/content-studio/content-studio-editor";
import { ContentStudioReviewPanel } from "@/components/content-studio/content-studio-review-panel";
import { ContentStudioCompliancePanel } from "@/components/content-studio/content-studio-compliance-panel";
import { CanonicalPublishPanel } from "@/components/publishing/canonical-publish-panel";

type StudioDetail = {
  id: string;
  title: string;
  studioType: string;
  status: string;
  version: number;
  studioObjective: string | null;
  audienceSummary: string | null;
  contentBody: string | null;
  primaryCTA: string | null;
  primaryChannel: string | null;
  contentCampaignId: string | null;
  dueAt: string | null;
  scheduledFor: string | null;
  timezone: string | null;
  allowedTransitions: string[];
  variants: Array<{
    id: string;
    marketingChannel: string | null;
    channelBody: string | null;
    caption: string | null;
  }>;
  assets: Array<{
    id: string;
    marketingAssetId: string;
    title: string;
    approvedForMarketing: boolean;
  }>;
  knowledgeReferences: Array<{
    id: string;
    referenceType: string;
    label: string;
    excerpt: string | null;
  }>;
  versions: Array<{
    id: string;
    versionNumber: number;
    changeSummary: string | null;
    createdAt: string;
  }>;
  reviews: Array<{
    id: string;
    status: string;
    feedback: string | null;
    contentVersion: number;
    createdAt: string;
  }>;
  comments: Array<{
    id: string;
    body: string;
    status: string;
    createdAt: string;
  }>;
  complianceChecks: Array<{
    checkType: string;
    result: string;
    message: string;
    blocking: boolean;
  }>;
};

function toLocalDatetime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function ContentStudioDetailPage() {
  const params = useParams<{ contentId: string }>();
  const { preference } = useWorkspace();
  const [item, setItem] = useState<StudioDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;
  const contentId = params.contentId;

  const loadItem = useCallback(async () => {
    if (!organisationId || !brandId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ item: StudioDetail }>(
        `/api/brands/${brandId}/content-studio/${contentId}?organisationId=${organisationId}`,
        { organisationId },
      );
      setItem(data.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content.");
    } finally {
      setLoading(false);
    }
  }, [organisationId, brandId, contentId]);

  useEffect(() => {
    void loadItem();
  }, [loadItem]);

  async function handleSave(values: StudioEditorValues) {
    if (!organisationId || !brandId || !item) return;
    setSaving(true);
    try {
      await apiFetch(
        `/api/brands/${brandId}/content-studio/${contentId}?organisationId=${organisationId}`,
        {
          method: "PATCH",
          organisationId,
          body: JSON.stringify({
            title: values.title,
            studioType: values.studioType,
            studioObjective: values.studioObjective || undefined,
            audienceSummary: values.audienceSummary || undefined,
            contentBody: values.contentBody || undefined,
            primaryCTA: values.primaryCTA || undefined,
            primaryChannel: values.primaryChannel || undefined,
            dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : undefined,
            scheduledFor: values.scheduledFor
              ? new Date(values.scheduledFor).toISOString()
              : undefined,
            timezone: values.timezone || undefined,
            expectedVersion: item.version,
          }),
        },
      );
      await loadItem();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save content.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTransition(toStatus: string) {
    if (!organisationId || !brandId) return;
    await apiFetch(
      `/api/brands/${brandId}/content-studio/${contentId}?organisationId=${organisationId}`,
      { method: "POST", organisationId, body: JSON.stringify({ toStatus }) },
    );
    await loadItem();
  }

  async function handleSubmitForReview() {
    if (!organisationId || !brandId) return;
    await apiFetch(
      `/api/brands/${brandId}/content-studio/${contentId}/submit-for-review?organisationId=${organisationId}`,
      { method: "POST", organisationId },
    );
    await loadItem();
  }

  async function handleApprove() {
    if (!organisationId || !brandId) return;
    await apiFetch(
      `/api/brands/${brandId}/content-studio/${contentId}/approve?organisationId=${organisationId}`,
      { method: "POST", organisationId, body: JSON.stringify({}) },
    );
    await loadItem();
  }

  async function handleRequestChanges(feedback: string) {
    if (!organisationId || !brandId) return;
    await apiFetch(
      `/api/brands/${brandId}/content-studio/${contentId}/request-changes?organisationId=${organisationId}`,
      { method: "POST", organisationId, body: JSON.stringify({ decisionNote: feedback }) },
    );
    await loadItem();
  }

  async function handleRunCompliance() {
    if (!organisationId || !brandId) return;
    await apiFetch(
      `/api/brands/${brandId}/content-studio/${contentId}/compliance?organisationId=${organisationId}`,
      { organisationId },
    );
    await loadItem();
  }

  if (loading) {
    return <p className="py-8 text-center text-muted-foreground">Loading…</p>;
  }

  if (error || !item) {
    return (
      <div className="py-8 text-center">
        <p className="text-destructive">{error ?? "Content not found."}</p>
        <ButtonLink className="mt-4" variant="outline" size="sm" href="/content/studio">
          Back to studio
        </ButtonLink>
      </div>
    );
  }

  const readOnly = !["IDEA", "BRIEF", "DRAFT", "CHANGES_REQUESTED"].includes(item.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        description={`${item.studioType.replace(/_/g, " ")} · Version ${item.version}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge>{item.status.replace(/_/g, " ")}</Badge>
            <ButtonLink variant="outline" size="sm" href="/content/studio">
              Back
            </ButtonLink>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ContentStudioEditor
            initialValues={{
              title: item.title,
              studioType: item.studioType,
              studioObjective: item.studioObjective ?? "",
              audienceSummary: item.audienceSummary ?? "",
              contentBody: item.contentBody ?? "",
              primaryCTA: item.primaryCTA ?? "",
              primaryChannel: item.primaryChannel ?? "",
              contentCampaignId: item.contentCampaignId ?? "",
              dueAt: toLocalDatetime(item.dueAt),
              scheduledFor: toLocalDatetime(item.scheduledFor),
              timezone: item.timezone ?? "",
            }}
            version={item.version}
            readOnly={readOnly}
            onSave={readOnly ? undefined : handleSave}
            saving={saving}
          />

          {item.variants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Channel variants</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {item.variants.map((variant) => (
                  <div key={variant.id} className="rounded-md border p-3">
                    <p className="text-sm font-medium">
                      {variant.marketingChannel ?? "Channel"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {variant.channelBody ?? variant.caption ?? "No content"}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {item.assets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {item.assets.map((asset) => (
                  <div key={asset.id} className="flex items-center justify-between text-sm">
                    <span>{asset.title}</span>
                    {!asset.approvedForMarketing && (
                      <Badge variant="warning">Not approved</Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {item.knowledgeReferences.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Knowledge references</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {item.knowledgeReferences.map((ref) => (
                  <div key={ref.id} className="rounded-md border p-2 text-sm">
                    <p className="font-medium">{ref.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {ref.referenceType.replace(/_/g, " ")}
                    </p>
                    {ref.excerpt && (
                      <p className="mt-1 text-muted-foreground">{ref.excerpt}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {item.versions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Version history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {item.versions.map((version) => (
                  <div key={version.id} className="flex items-center justify-between text-sm">
                    <span>
                      v{version.versionNumber}
                      {version.changeSummary && ` — ${version.changeSummary}`}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(version.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <ContentStudioReviewPanel
            status={item.status}
            reviews={item.reviews}
            comments={item.comments}
            allowedTransitions={item.allowedTransitions}
            onSubmitForReview={handleSubmitForReview}
            onApprove={handleApprove}
            onRequestChanges={handleRequestChanges}
            onTransition={handleTransition}
            canApprove
          />

          <ContentStudioCompliancePanel
            findings={item.complianceChecks}
            onRunCheck={handleRunCompliance}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Publish to Instagram</CardTitle>
            </CardHeader>
            <CardContent>
              <CanonicalPublishPanel
                brandId={brandId}
                organisationId={organisationId}
                contentId={contentId}
                contentVariantId={item.variants.find((v) => v.marketingChannel === "INSTAGRAM")?.id}
                contentStatus={item.status}
                onPublished={() => void loadItem()}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="font-semibold">{item.title}</h3>
                {item.studioObjective && (
                  <p className="mt-2 text-sm text-muted-foreground">{item.studioObjective}</p>
                )}
                <div className="mt-4 whitespace-pre-wrap text-sm">
                  {item.contentBody ?? "No content body yet."}
                </div>
                {item.primaryCTA && (
                  <p className="mt-4 text-sm font-medium text-primary">{item.primaryCTA}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
