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
  const [mode, setMode] = useState("FROM_IDEA");
  const [platforms, setPlatforms] = useState<string[]>(["LINKEDIN", "INSTAGRAM"]);
  const [tone, setTone] = useState("");
  const [cta, setCta] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [ideas, setIdeas] = useState<Array<{ title: string; angle: string }>>([]);
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
        `/api/brands/${brandId}/content/generate?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({
            mode,
            title: title || undefined,
            brief: primaryMessage,
            format: contentType,
            platforms,
            tone: tone || undefined,
            cta: cta || undefined,
            destinationUrl: destinationUrl || undefined,
            sourceText: sourceText || undefined,
            variantCount: 1,
          }),
        },
      );
      router.push(`/content/${data.item.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create content.");
      setLoading(false);
    }
  }

  async function generateIdeas() {
    if (!organisationId || !brandId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ ideas: Array<{ title: string; angle: string }> }>(
        `/api/brands/${brandId}/content/ideas?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({ brief: primaryMessage || undefined, count: 5, useAi: true }),
        },
      );
      setIdeas(data.ideas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate ideas.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="AI Content Studio"
        description="Generate brand-aware drafts. Content is never published automatically."
        breadcrumbs={[{ label: "Content Studio", href: "/content" }, { label: "New content" }]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Generation brief</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div>
              <Input
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Generation mode</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="FROM_IDEA">From an idea</option>
                <option value="FROM_OBJECTIVE">From a marketing objective</option>
                <option value="FROM_OFFER">From a product offer</option>
                <option value="FROM_ARTICLE">From supplied article text</option>
                <option value="REPURPOSE">Repurpose supplied content</option>
                <option value="PLATFORM_VARIANTS">Create platform variants</option>
                <option value="VIDEO_SCRIPT">Generate a video script</option>
              </select>
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
              <label className="mb-1 block text-sm font-medium">Brief</label>
              <textarea
                className="min-h-28 w-full rounded-md border px-3 py-2 text-sm"
                value={primaryMessage}
                onChange={(e) => setPrimaryMessage(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Platforms</label>
              <div className="flex flex-wrap gap-3 text-sm">
                {["INSTAGRAM", "TIKTOK", "LINKEDIN", "FACEBOOK", "YOUTUBE", "X"].map((platform) => (
                  <label key={platform} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={platforms.includes(platform)}
                      onChange={(event) =>
                        setPlatforms((current) =>
                          event.target.checked
                            ? [...current, platform]
                            : current.filter((item) => item !== platform),
                        )
                      }
                    />
                    {platform}
                  </label>
                ))}
              </div>
            </div>
            <Input
              label="Tone (optional)"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="e.g. confident and friendly"
            />
            <Input
              label="CTA (optional)"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="e.g. Book a demo"
            />
            <Input
              label="Destination URL (optional)"
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
            />
            {["FROM_ARTICLE", "REPURPOSE"].includes(mode) ? (
              <div>
                <label className="mb-1 block text-sm font-medium">Approved source text</label>
                <textarea
                  className="min-h-28 w-full rounded-md border px-3 py-2 text-sm"
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-500">
                  URLs are not scraped. Paste approved or manually retrieved source material.
                </p>
              </div>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={loading || !brandId || platforms.length === 0}>
                Generate draft
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void generateIdeas()}
                disabled={loading || !brandId}
              >
                Generate ideas
              </Button>
              <Link href="/content" className="inline-flex h-9 items-center px-4 text-sm">
                Cancel
              </Link>
            </div>
          </form>
          {ideas.length > 0 ? (
            <div className="mt-6 space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Suggested ideas</p>
              {ideas.map((idea) => (
                <button
                  key={idea.title}
                  type="button"
                  className="block w-full rounded-md border p-3 text-left text-sm hover:bg-slate-50"
                  onClick={() => {
                    setTitle(idea.title);
                    setPrimaryMessage(idea.angle);
                  }}
                >
                  <span className="font-medium">{idea.title}</span>
                  <br />
                  <span className="text-slate-600">{idea.angle}</span>
                </button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
