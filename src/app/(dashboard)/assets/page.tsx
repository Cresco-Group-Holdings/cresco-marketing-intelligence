"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export default function AssetsHubPage() {
  const router = useRouter();
  const { preference, loading, error } = useWorkspace();
  const brandId = preference.currentBrandId;

  useEffect(() => {
    if (!loading && brandId) {
      router.replace(`/brands/${brandId}/assets`);
    }
  }, [brandId, loading, router]);

  if (loading) {
    return <p className="text-sm text-slate-600">Loading workspace...</p>;
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
    return <p className="text-sm text-slate-600">Opening asset library...</p>;
  }

  return (
    <>
      <PageHeader
        title="Assets"
        description="Secure marketing asset library with governance and approval controls."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Assets" }]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Select a brand</CardTitle>
          <CardDescription>
            Marketing assets are brand-scoped. Choose a brand in the workspace header to manage
            uploads and approvals.
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <ButtonLink href="/brands">Go to brands</ButtonLink>
        </div>
      </Card>
    </>
  );
}
