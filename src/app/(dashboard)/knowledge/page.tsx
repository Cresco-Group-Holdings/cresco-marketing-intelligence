"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export default function KnowledgeHubPage() {
  const router = useRouter();
  const { preference, loading, error } = useWorkspace();
  const brandId = preference.currentBrandId;

  useEffect(() => {
    if (!loading && brandId) {
      router.replace(`/brands/${brandId}/knowledge`);
    }
  }, [brandId, loading, router]);

  if (loading) {
    return <p className="text-sm text-foreground-muted">Loading workspace...</p>;
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unable to load workspace</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (brandId) {
    return <p className="text-sm text-foreground-muted">Opening knowledge base...</p>;
  }

  return (
    <>
      <PageHeader
        title="Knowledge Base"
        description="Structured brand knowledge for audiences, offers, messaging, and compliance."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Knowledge Base" }]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Select a brand</CardTitle>
          <CardDescription>
            Brand knowledge is managed per brand. Choose a brand in the workspace header or create
            one to continue.
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <ButtonLink href="/brands">Go to brands</ButtonLink>
        </div>
      </Card>
    </>
  );
}
