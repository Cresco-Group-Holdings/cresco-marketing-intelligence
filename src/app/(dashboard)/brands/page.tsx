"use client";

import Link from "next/link";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyState } from "@/components/layout/module-empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BrandsPage() {
  const { brands, preference, loading } = useWorkspace();

  return (
    <>
      <PageHeader
        title="Brands"
        description="Manage brand identities, positioning, and voice guidelines across projects."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Brands" }]}
        actions={
          preference.currentProjectId ? (
            <ButtonLink href="/brands/new">Create brand</ButtonLink>
          ) : null
        }
      />

      {loading ? <p className="text-sm text-slate-600">Loading brands…</p> : null}

      {!loading && !preference.currentProjectId ? (
        <ModuleEmptyState
          title="Select a project"
          description="Choose a project from the workspace header to view and manage its brands."
          futureCapabilities={["Project-scoped brand lists", "Brand profile management"]}
          comingSoon={false}
        />
      ) : null}

      {!loading && preference.currentProjectId && brands.length === 0 ? (
        <ModuleEmptyState
          title="No brands yet"
          description="Create your first brand for this project to define positioning and future AI knowledge."
          futureCapabilities={[
            "Brand voice and messaging guidelines",
            "Visual identity references",
            "Audience and market positioning",
          ]}
          comingSoon={false}
        />
      ) : null}

      {!loading && brands.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {brands.map((brand) => (
            <Card key={brand.id}>
              <CardHeader>
                <CardTitle>{brand.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Link href={`/brands/${brand.id}`} className="text-sm font-medium text-slate-900 hover:underline">
                  View brand
                </Link>
                <Link
                  href={`/brands/${brand.id}/profile`}
                  className="text-sm font-medium text-slate-600 hover:underline"
                >
                  Brand profile
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </>
  );
}
