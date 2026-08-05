"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import {
  ContentStudioEditor,
  type StudioEditorValues,
} from "@/components/content-studio/content-studio-editor";

export default function NewContentStudioPage() {
  const router = useRouter();
  const { preference } = useWorkspace();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;

  async function handleCreate(values: StudioEditorValues) {
    if (!organisationId || !brandId) return;
    setSaving(true);
    setError(null);
    try {
      const data = await apiFetch<{ item: { id: string } }>(
        `/api/brands/${brandId}/content-studio?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: {
            title: values.title,
            studioType: values.studioType,
            studioObjective: values.studioObjective || undefined,
            audienceSummary: values.audienceSummary || undefined,
            contentBody: values.contentBody || undefined,
            primaryCTA: values.primaryCTA || undefined,
            primaryChannel: values.primaryChannel || undefined,
            contentCampaignId: values.contentCampaignId || undefined,
            dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : undefined,
            scheduledFor: values.scheduledFor
              ? new Date(values.scheduledFor).toISOString()
              : undefined,
            timezone: values.timezone || undefined,
          },
        },
      );
      router.push(`/content/studio/${data.item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create content.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="New content"
        description="Create a new content brief or draft in Content Studio."
        actions={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            Cancel
          </Button>
        }
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <ContentStudioEditor onSave={handleCreate} saving={saving} />
    </div>
  );
}
