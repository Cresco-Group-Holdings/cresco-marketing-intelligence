"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";

export default function EditContentPage() {
  const params = useParams<{ contentId: string }>();
  const router = useRouter();
  const { preference } = useWorkspace();
  const [title, setTitle] = useState("");
  const [primaryMessage, setPrimaryMessage] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;
  const contentId = params.contentId;

  const loadItem = useCallback(async () => {
    if (!organisationId || !brandId) return;
    const data = await apiFetch<{
      item: { title: string; primaryMessage: string | null; destinationUrl: string | null };
    }>(`/api/brands/${brandId}/content/${contentId}?organisationId=${organisationId}`, {
      organisationId,
    });
    setTitle(data.item.title);
    setPrimaryMessage(data.item.primaryMessage ?? "");
    setDestinationUrl(data.item.destinationUrl ?? "");
  }, [organisationId, brandId, contentId]);

  useEffect(() => {
    void loadItem();
  }, [loadItem]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!organisationId || !brandId) return;
    setLoading(true);
    await apiFetch(`/api/brands/${brandId}/content/${contentId}?organisationId=${organisationId}`, {
      method: "PATCH",
      organisationId,
      body: JSON.stringify({ title, primaryMessage, destinationUrl }),
    });
    setLoading(false);
    router.push(`/content/${contentId}`);
  }

  return (
    <>
      <PageHeader
        title="Edit content"
        description="Update the core content brief and destination details."
        breadcrumbs={[
          { label: "Content Studio", href: "/content" },
          { label: "Edit" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Content fields</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void handleSave(event)}>
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea
              className="min-h-28 w-full rounded-md border px-3 py-2 text-sm"
              value={primaryMessage}
              onChange={(e) => setPrimaryMessage(e.target.value)}
            />
            <Input
              label="Destination URL"
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              placeholder="Destination URL"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                Save changes
              </Button>
              <Link href={`/content/${contentId}`}>Cancel</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
