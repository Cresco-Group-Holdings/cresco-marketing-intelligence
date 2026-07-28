"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";

export default function ProjectsSettingsPage() {
  const { preference } = useWorkspace();
  const [projects, setProjects] = useState<Array<{ id: string; name: string; slug: string }>>([]);

  useEffect(() => {
    if (!preference.currentOrganisationId) return;
    void apiFetch<{ projects: Array<{ id: string; name: string; slug: string }> }>(
      `/api/projects?organisationId=${preference.currentOrganisationId}`,
      { organisationId: preference.currentOrganisationId },
    ).then((data) => setProjects(data.projects));
  }, [preference.currentOrganisationId]);

  return (
    <>
      <PageHeader
        title="Projects"
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Projects" }]}
        actions={<ButtonLink href="/settings/projects/new">Create project</ButtonLink>}
      />
      <div className="grid gap-4">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardHeader><CardTitle>{project.name}</CardTitle></CardHeader>
            <CardContent>
              <Link href={`/settings/projects/${project.id}`} className="text-sm font-medium text-slate-900 hover:underline">
                Manage project
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
