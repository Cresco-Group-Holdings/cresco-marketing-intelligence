"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";

type Project = {
  id: string;
  title: string;
  outputType: string;
  pages: Array<{
    id: string;
    pageNumber: number;
    elements: Array<{
      id: string;
      elementType: string;
      properties: { text?: string };
      locked: boolean;
    }>;
  }>;
};

export default function VisualProjectPage() {
  const { visualProjectId } = useParams<{ visualProjectId: string }>();
  const { preference } = useWorkspace();
  const [project, setProject] = useState<Project | null>(null);
  const [active, setActive] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;

  const load = useCallback(async () => {
    if (!organisationId || !brandId) return;
    const data = await apiFetch<{ project: Project }>(
      `/api/brands/${brandId}/visual-studio/projects/${visualProjectId}?organisationId=${organisationId}`,
      { organisationId },
    );
    setProject(data.project);
  }, [organisationId, brandId, visualProjectId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function saveText(elementId: string, text: string) {
    if (!organisationId || !brandId) return;
    setProject((current) =>
      current
        ? {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              elements: page.elements.map((element) =>
                element.id === elementId
                  ? { ...element, properties: { ...element.properties, text } }
                  : element,
              ),
            })),
          }
        : current,
    );
    await apiFetch(
      `/api/brands/${brandId}/visual-studio/projects/${visualProjectId}/elements/${elementId}?organisationId=${organisationId}`,
      { method: "PATCH", organisationId, body: JSON.stringify({ properties: { text } }) },
    );
  }
  async function exportPng() {
    if (!organisationId || !brandId) return;
    setExporting(true);
    try {
      const data = await apiFetch<{ warnings: string[] }>(
        `/api/brands/${brandId}/visual-studio/projects/${visualProjectId}/export?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({ format: "PNG", altText: "Branded visual export" }),
        },
      );
      setMessage(
        data.warnings.length ? data.warnings.join(" ") : "PNG export saved to the Asset Library.",
      );
    } finally {
      setExporting(false);
    }
  }
  if (!project) return <p className="text-sm text-foreground-muted">Loading visual project…</p>;
  const page = project.pages[active];
  return (
    <>
      <PageHeader
        title={project.title}
        description={`${project.outputType.replaceAll("_", " ")} · editable visual draft`}
        breadcrumbs={[{ label: "Visual Studio", href: "/visual-studio" }, { label: project.title }]}
        actions={
          <Button onClick={() => void exportPng()} disabled={exporting}>
            {exporting ? "Exporting…" : "Export PNG"}
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Slides</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {project.pages.map((item, index) => (
              <Button
                key={item.id}
                variant={index === active ? "primary" : "outline"}
                className="w-full"
                onClick={() => setActive(index)}
              >
                Slide {item.pageNumber}
              </Button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Slide {page?.pageNumber} editor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {page?.elements
              .filter((element) => element.elementType === "TEXT")
              .map((element) => (
                <div key={element.id}>
                  <label className="mb-1 block text-sm font-medium">
                    Text {element.locked ? "(brand locked)" : ""}
                  </label>
                  <textarea
                    className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
                    value={element.properties.text ?? ""}
                    disabled={element.locked}
                    onChange={(event) => void saveText(element.id, event.target.value)}
                  />
                </div>
              ))}
            <p className="text-xs text-foreground-subtle">
              Safe-area guides, contrast, minimum-text-size, and overflow checks run when exporting.
            </p>
            {message ? <p className="text-sm text-foreground-muted">{message}</p> : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
