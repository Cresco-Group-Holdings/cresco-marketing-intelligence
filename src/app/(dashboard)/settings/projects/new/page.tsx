"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { slugFromName } from "@/lib/utils/slug";

export default function NewProjectSettingsPage() {
  const router = useRouter();
  const { preference } = useWorkspace();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  async function createProject() {
    if (!preference.currentOrganisationId) return;
    await apiFetch(`/api/projects?organisationId=${preference.currentOrganisationId}`, {
      method: "POST",
      organisationId: preference.currentOrganisationId,
      body: JSON.stringify({ name, slug: slug || slugFromName(name) }),
    });
    router.push("/settings/projects");
  }

  return (
    <>
      <PageHeader title="Create project" breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Projects", href: "/settings/projects" }, { label: "Create" }]} />
      <Card>
        <CardHeader><CardTitle>Project details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => { setName(e.target.value); setSlug(slugFromName(e.target.value)); }} />
          <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <Button onClick={() => void createProject()}>Create project</Button>
        </CardContent>
      </Card>
    </>
  );
}
