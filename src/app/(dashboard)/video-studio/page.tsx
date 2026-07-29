"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";

export default function VideoStudioPage() {
  const router = useRouter();
  const { preference } = useWorkspace();
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(false);
  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!organisationId || !brandId) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ project: { id: string } }>(
        `/api/brands/${brandId}/video-studio/projects?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({
            title,
            script,
            videoType: "EDUCATIONAL_EXPLAINER",
            targetDuration: 30,
          }),
        },
      );
      router.push(`/video-studio/${data.project.id}`);
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <PageHeader
        title="AI Video & Reels Studio"
        description="Turn approved scripts into editable, vertical-video render projects."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Video Studio" }]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Create a short-video project</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void create(event)}>
            <Input
              label="Project title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
            <textarea
              className="min-h-40 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Paste the approved script. Each paragraph becomes an editable scene."
              value={script}
              onChange={(event) => setScript(event.target.value)}
              required
            />
            <p className="text-xs text-slate-500">
              Vertical 9:16 · 5–180 seconds · render jobs are queued for a background worker.
            </p>
            <Button type="submit" disabled={loading || !brandId}>
              {loading ? "Creating…" : "Create scenes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
