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

export default function NewBrandPage() {
  const router = useRouter();
  const { preference } = useWorkspace();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!preference.currentOrganisationId || !preference.currentProjectId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ brand: { id: string } }>(
        `/api/brands?organisationId=${preference.currentOrganisationId}&projectId=${preference.currentProjectId}`,
        {
          method: "POST",
          organisationId: preference.currentOrganisationId,
          projectId: preference.currentProjectId,
          body: JSON.stringify({ name, slug: slug || slugFromName(name), status: "ACTIVE" }),
        },
      );
      router.push(`/brands/${data.brand.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create brand.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Create brand"
        description="Add a brand to the current project."
        breadcrumbs={[
          { label: "Brands", href: "/brands" },
          { label: "Create brand" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Brand details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <Input label="Name" value={name} onChange={(event) => {
              setName(event.target.value);
              setSlug(slugFromName(event.target.value));
            }} required />
            <Input label="Slug" value={slug} onChange={(event) => setSlug(event.target.value)} required />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" disabled={loading}>Create brand</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
