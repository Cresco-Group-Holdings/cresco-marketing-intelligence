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
  const [variants, setVariants] = useState<
    Array<{
      provider: string;
      format: string;
      caption: string;
      headline: string;
      hashtags: string[];
    }>
  >([]);
  const [activePlatform, setActivePlatform] = useState(0);
  const [transforming, setTransforming] = useState(false);
  const [loading, setLoading] = useState(false);

  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;
  const contentId = params.contentId;

  const loadItem = useCallback(async () => {
    if (!organisationId || !brandId) return;
    const data = await apiFetch<{
      item: {
        title: string;
        primaryMessage: string | null;
        destinationUrl: string | null;
        variants: Array<{
          provider: string;
          format: string;
          caption: string | null;
          headline: string | null;
          hashtags: string[];
        }>;
      };
    }>(`/api/brands/${brandId}/content/${contentId}?organisationId=${organisationId}`, {
      organisationId,
    });
    setTitle(data.item.title);
    setPrimaryMessage(data.item.primaryMessage ?? "");
    setDestinationUrl(data.item.destinationUrl ?? "");
    setVariants(
      data.item.variants.map((variant) => ({
        provider: variant.provider,
        format: variant.format,
        caption: variant.caption ?? "",
        headline: variant.headline ?? "",
        hashtags: variant.hashtags,
      })),
    );
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
      body: JSON.stringify({ title, primaryMessage, destinationUrl, variants }),
    });
    setLoading(false);
    router.push(`/content/${contentId}`);
  }

  async function regenerateCaption() {
    const variant = variants[activePlatform];
    if (!organisationId || !brandId || !variant?.caption) return;
    setTransforming(true);
    try {
      const data = await apiFetch<{
        item: { variants: Array<{ provider: string; caption: string | null }> };
      }>(
        `/api/brands/${brandId}/content/${contentId}/regenerate?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({ field: "caption", platform: variant.provider }),
        },
      );
      const regenerated = data.item.variants.find((item) => item.provider === variant.provider);
      if (regenerated?.caption) {
        setVariants((current) =>
          current.map((item, index) =>
            index === activePlatform ? { ...item, caption: regenerated.caption ?? "" } : item,
          ),
        );
      }
    } finally {
      setTransforming(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Edit content"
        description="Update the core content brief and destination details."
        breadcrumbs={[{ label: "Content Studio", href: "/content" }, { label: "Edit" }]}
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
            {variants.length > 0 ? (
              <div className="space-y-3 rounded-md border p-3">
                <div className="flex flex-wrap gap-2">
                  {variants.map((variant, index) => (
                    <Button
                      key={variant.provider}
                      type="button"
                      size="sm"
                      variant={activePlatform === index ? "primary" : "outline"}
                      onClick={() => setActivePlatform(index)}
                    >
                      {variant.provider}
                    </Button>
                  ))}
                </div>
                <Input
                  label={`${variants[activePlatform]?.provider} headline`}
                  value={variants[activePlatform]?.headline ?? ""}
                  onChange={(event) =>
                    setVariants((current) =>
                      current.map((item, index) =>
                        index === activePlatform ? { ...item, headline: event.target.value } : item,
                      ),
                    )
                  }
                />
                <textarea
                  className="min-h-32 w-full rounded-md border px-3 py-2 text-sm"
                  value={variants[activePlatform]?.caption ?? ""}
                  onChange={(event) =>
                    setVariants((current) =>
                      current.map((item, index) =>
                        index === activePlatform ? { ...item, caption: event.target.value } : item,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={transforming}
                  onClick={() => void regenerateCaption()}
                >
                  {transforming ? "Regenerating…" : "Regenerate selected caption"}
                </Button>
              </div>
            ) : null}
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
