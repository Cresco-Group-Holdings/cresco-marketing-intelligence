"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";

export default function NewContentPage() {
  const router = useRouter();
  const { preference } = useWorkspace();
  const [title, setTitle] = useState("");
  const [primaryMessage, setPrimaryMessage] = useState("");
  const [contentType, setContentType] = useState("TEXT_POST");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!organisationId || !brandId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ item: { id: string } }>(
        `/api/brands/${brandId}/content?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({
            title,
            contentType,
            primaryMessage,
            variants: [
              { provider: "LINKEDIN", format: contentType, caption: primaryMessage },
              { provider: "INSTAGRAM", format: contentType, caption: primaryMessage },
            ],
          }),
        },
      );
      router.push(`/content/${data.item.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create content.");
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="New content"
        description="Create a campaign idea and platform variants."
        breadcrumbs={[
          { label: "Content Studio", href: "/content" },
          { label: "New content" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Content brief</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div>
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Content type</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
              >
                <option value="TEXT_POST">Text post</option>
                <option value="IMAGE_POST">Image post</option>
                <option value="SHORT_VIDEO">Short video</option>
                <option value="CAROUSEL">Carousel</option>
                <option value="ARTICLE_LINK">Article link</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Primary message</label>
              <textarea
                className="min-h-28 w-full rounded-md border px-3 py-2 text-sm"
                value={primaryMessage}
                onChange={(e) => setPrimaryMessage(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={loading || !brandId}>
                Create content
              </Button>
              <Link href="/content" className="inline-flex h-9 items-center px-4 text-sm">
                Cancel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
