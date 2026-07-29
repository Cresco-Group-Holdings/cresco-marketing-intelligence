"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";

export default function VisualStudioPage() {
  const router = useRouter();
  const { preference } = useWorkspace();
  const [title, setTitle] = useState("");
  const [outputType, setOutputType] = useState("INSTAGRAM_CAROUSEL");
  const [outline, setOutline] = useState("");
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [templateId, setTemplateId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;

  useEffect(() => {
    if (!organisationId || !brandId) return;
    void apiFetch<{ templates: Array<{ id: string; name: string }> }>(
      `/api/brands/${brandId}/visual-studio/templates?organisationId=${organisationId}`,
      { organisationId },
    ).then((data) => setTemplates(data.templates));
  }, [organisationId, brandId]);

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    if (!organisationId || !brandId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ project: { id: string } }>(
        `/api/brands/${brandId}/visual-studio/projects?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({
            title,
            outputType,
            templateId: templateId || undefined,
            outline: outline
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
            brandLocks: { brandColours: true, safeMargins: true, logoPosition: false },
          }),
        },
      );
      router.push(`/visual-studio/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create visual project.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="AI Image & Carousel Studio"
        description="Create editable, brand-controlled visual drafts. Nothing is published automatically."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Visual Studio" }]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Start a visual project</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void createProject(event)}>
            <Input
              label="Project title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <label className="block text-sm font-medium">Output</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={outputType}
              onChange={(event) => setOutputType(event.target.value)}
            >
              <option value="SQUARE_POST">Square social post</option>
              <option value="PORTRAIT_POST">Portrait social post</option>
              <option value="LANDSCAPE_POST">Landscape post</option>
              <option value="INSTAGRAM_CAROUSEL">Instagram carousel</option>
              <option value="LINKEDIN_CAROUSEL">LinkedIn carousel</option>
              <option value="REEL_COVER">Reel cover</option>
              <option value="TIKTOK_COVER">TikTok cover</option>
              <option value="YOUTUBE_THUMBNAIL">YouTube thumbnail</option>
              <option value="STORY_GRAPHIC">Story graphic</option>
              <option value="QUOTE_CARD">Quote card</option>
              <option value="SIMPLE_INFOGRAPHIC">Simple infographic</option>
            </select>
            <label className="block text-sm font-medium">Design template</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
            >
              <option value="">Use brand default layout</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <div>
              <label className="mb-1 block text-sm font-medium">Slide outline</label>
              <textarea
                className="min-h-36 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="One slide per line"
                value={outline}
                onChange={(event) => setOutline(event.target.value)}
                required
              />
            </div>
            <p className="text-xs text-slate-500">
              Brand colours and safe margins are locked by default. Add or edit slide text after
              creating the draft.
            </p>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <Button type="submit" disabled={loading || !brandId}>
              {loading ? "Creating…" : "Create visual draft"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
