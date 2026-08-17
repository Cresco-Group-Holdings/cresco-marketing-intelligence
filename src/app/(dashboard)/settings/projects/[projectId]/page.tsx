"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";

export default function ProjectSettingsDetailPage() {
  const params = useParams<{ projectId: string }>();
  const { preference } = useWorkspace();
  const [project, setProject] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!preference.currentOrganisationId) return;
    void apiFetch<{ project: Record<string, string | null> }>(
      `/api/projects/${params.projectId}?organisationId=${preference.currentOrganisationId}`,
      { organisationId: preference.currentOrganisationId },
    ).then((data) => setProject(data.project));
  }, [params.projectId, preference.currentOrganisationId]);

  return (
    <>
      <PageHeader title={project.name ?? "Project"} breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Projects", href: "/settings/projects" }, { label: project.name ?? "Project" }]} />
      <Card>
        <CardHeader><CardTitle>{project.name}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-foreground-muted">
          <p>Slug: {project.slug}</p>
          <p>Status: {project.status}</p>
          {project.description ? <p>{project.description}</p> : null}
        </CardContent>
      </Card>
    </>
  );
}
