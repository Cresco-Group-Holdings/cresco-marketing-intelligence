"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { calculateBrandProfileCompleteness } from "@/lib/brand-profile/completeness";

type BrandProfile = {
  shortDescription?: string | null;
  longDescription?: string | null;
  mission?: string | null;
  valueProposition?: string | null;
  targetAudience?: string | null;
  customerProblems?: string | null;
  keyBenefits?: string | null;
  productsAndServices?: string | null;
  preferredTone?: string | null;
  prohibitedTone?: string | null;
  preferredLanguage?: string | null;
  complianceNotes?: string | null;
  updatedAt?: string;
};

export default function BrandProfilePage() {
  const params = useParams<{ brandId: string }>();
  const { preference } = useWorkspace();
  const [profile, setProfile] = useState<BrandProfile>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!preference.currentOrganisationId) return;
    void apiFetch<{ profile: BrandProfile }>(
      `/api/brands/${params.brandId}/profile?organisationId=${preference.currentOrganisationId}`,
      { organisationId: preference.currentOrganisationId },
    )
      .then((data) => setProfile(data.profile))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load profile."));
  }, [params.brandId, preference.currentOrganisationId]);

  async function saveProfile() {
    if (!preference.currentOrganisationId) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const data = await apiFetch<{ profile: BrandProfile }>(
        `/api/brands/${params.brandId}/profile?organisationId=${preference.currentOrganisationId}`,
        {
          method: "PUT",
          organisationId: preference.currentOrganisationId,
          body: JSON.stringify(profile),
        },
      );
      setProfile(data.profile);
      setMessage("Brand profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setLoading(false);
    }
  }

  const completeness = calculateBrandProfileCompleteness(profile as Parameters<typeof calculateBrandProfileCompleteness>[0]);

  return (
    <>
      <PageHeader
        title="Brand profile"
        description="Structured brand knowledge for future AI workflows. No AI providers are connected yet."
        breadcrumbs={[
          { label: "Brands", href: "/brands" },
          { label: "Brand profile" },
        ]}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Completeness</CardTitle>
          <CardDescription>
            {completeness}% complete based on populated fields. Last updated:{" "}
            {profile.updatedAt ? new Date(profile.updatedAt).toLocaleString() : "Not saved yet"}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        {[
          ["Overview", ["shortDescription", "longDescription", "mission", "valueProposition"]],
          ["Audience", ["targetAudience", "customerProblems"]],
          ["Offer", ["productsAndServices", "keyBenefits"]],
          ["Voice", ["preferredTone", "prohibitedTone", "preferredLanguage"]],
          ["Governance", ["complianceNotes"]],
        ].map(([title, fields]) => (
          <Card key={title as string}>
            <CardHeader>
              <CardTitle>{title as string}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(fields as string[]).map((field) => (
                <Input
                  key={field}
                  label={field.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                  value={(profile as Record<string, string | null | undefined>)[field] ?? ""}
                  onChange={(event) =>
                    setProfile((current) => ({ ...current, [field]: event.target.value }))
                  }
                />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {message ? <p className="mt-4 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      <Button className="mt-6" onClick={() => void saveProfile()} disabled={loading}>
        Save brand profile
      </Button>
    </>
  );
}
