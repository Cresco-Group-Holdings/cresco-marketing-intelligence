"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";

type Brand = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  website?: string | null;
  primaryDomain?: string | null;
  status: string;
};

export default function BrandDetailPage() {
  const params = useParams<{ brandId: string }>();
  const { preference } = useWorkspace();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!preference.currentOrganisationId) return;
    void apiFetch<{ brand: Brand }>(
      `/api/brands/${params.brandId}?organisationId=${preference.currentOrganisationId}`,
      { organisationId: preference.currentOrganisationId },
    )
      .then((data) => setBrand(data.brand))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load brand."));
  }, [params.brandId, preference.currentOrganisationId]);

  return (
    <>
      <PageHeader
        title={brand?.name ?? "Brand"}
        description="Brand overview and configuration."
        breadcrumbs={[
          { label: "Brands", href: "/brands" },
          { label: brand?.name ?? "Brand" },
        ]}
        actions={
          <Link href={`/brands/${params.brandId}/profile`} className="text-sm font-medium text-slate-900 hover:underline">
            Edit brand profile
          </Link>
        }
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {brand ? (
        <Card>
          <CardHeader>
            <CardTitle>{brand.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>Slug: {brand.slug}</p>
            <p>Status: {brand.status}</p>
            {brand.website ? <p>Website: {brand.website}</p> : null}
            {brand.primaryDomain ? <p>Primary domain: {brand.primaryDomain}</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
