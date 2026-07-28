"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { slugFromName } from "@/lib/utils/slug";

const steps = ["organisation", "project", "brand", "profile", "complete"] as const;

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<(typeof steps)[number]>("organisation");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [organisationName, setOrganisationName] = useState("Cresco Group");
  const [organisationSlug, setOrganisationSlug] = useState("cresco-group");
  const [projectName, setProjectName] = useState("Cresco Grants Intelligence");
  const [projectSlug, setProjectSlug] = useState("cresco-grants-intelligence");
  const [brandName, setBrandName] = useState("Cresco Grants Intelligence");
  const [brandSlug, setBrandSlug] = useState("cresco-grants-intelligence");
  const [shortDescription, setShortDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [valueProposition, setValueProposition] = useState("");

  const [organisationId, setOrganisationId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);

  async function createOrganisation() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ organisation: { id: string } }>("/api/organisations", {
        method: "POST",
        body: JSON.stringify({
          name: organisationName,
          slug: organisationSlug || slugFromName(organisationName),
        }),
      });
      setOrganisationId(data.organisation.id);
      await apiFetch("/api/workspace", {
        method: "PUT",
        body: JSON.stringify({
          currentOrganisationId: data.organisation.id,
          onboardingStep: "project",
        }),
      });
      setStep("project");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organisation.");
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    if (!organisationId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ project: { id: string } }>(
        `/api/projects?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({
            name: projectName,
            slug: projectSlug || slugFromName(projectName),
          }),
        },
      );
      setProjectId(data.project.id);
      await apiFetch("/api/workspace", {
        method: "PUT",
        body: JSON.stringify({
          currentOrganisationId: organisationId,
          currentProjectId: data.project.id,
          onboardingStep: "brand",
        }),
      });
      setStep("brand");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
    } finally {
      setLoading(false);
    }
  }

  async function createBrand() {
    if (!organisationId || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ brand: { id: string } }>(
        `/api/brands?organisationId=${organisationId}&projectId=${projectId}`,
        {
          method: "POST",
          organisationId,
          projectId,
          body: JSON.stringify({
            name: brandName,
            slug: brandSlug || slugFromName(brandName),
            status: "ACTIVE",
          }),
        },
      );
      setBrandId(data.brand.id);
      await apiFetch("/api/workspace", {
        method: "PUT",
        body: JSON.stringify({
          currentOrganisationId: organisationId,
          currentProjectId: projectId,
          currentBrandId: data.brand.id,
          onboardingStep: "profile",
        }),
      });
      setStep("profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create brand.");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    if (!organisationId || !brandId) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/brands/${brandId}/profile?organisationId=${organisationId}`, {
        method: "PUT",
        organisationId,
        body: JSON.stringify({
          shortDescription,
          targetAudience,
          valueProposition,
        }),
      });
      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save brand profile.");
    } finally {
      setLoading(false);
    }
  }

  async function finishOnboarding() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/workspace", {
        method: "PUT",
        body: JSON.stringify({ completeOnboarding: true, onboardingStep: null }),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete onboarding.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Step {steps.indexOf(step) + 1} of 5</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Set up your workspace</h1>
        <p className="mt-2 text-sm text-slate-600">
          Create your organisation, first project, and brand to start using the platform.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {step === "organisation" ? (
        <Card>
          <CardHeader>
            <CardTitle>Create organisation</CardTitle>
            <CardDescription>Your organisation is the top-level tenant for teams and brands.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Organisation name"
              value={organisationName}
              onChange={(event) => {
                setOrganisationName(event.target.value);
                setOrganisationSlug(slugFromName(event.target.value));
              }}
            />
            <Input label="Slug" value={organisationSlug} onChange={(event) => setOrganisationSlug(event.target.value)} />
            <Button onClick={() => void createOrganisation()} disabled={loading}>
              Continue
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === "project" ? (
        <Card>
          <CardHeader>
            <CardTitle>Create first project</CardTitle>
            <CardDescription>Projects group brands for a product, client, or business unit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Project name"
              value={projectName}
              onChange={(event) => {
                setProjectName(event.target.value);
                setProjectSlug(slugFromName(event.target.value));
              }}
            />
            <Input label="Slug" value={projectSlug} onChange={(event) => setProjectSlug(event.target.value)} />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep("organisation")}>
                Back
              </Button>
              <Button onClick={() => void createProject()} disabled={loading}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "brand" ? (
        <Card>
          <CardHeader>
            <CardTitle>Create first brand</CardTitle>
            <CardDescription>Brands hold positioning, voice, and future AI knowledge.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Brand name"
              value={brandName}
              onChange={(event) => {
                setBrandName(event.target.value);
                setBrandSlug(slugFromName(event.target.value));
              }}
            />
            <Input label="Slug" value={brandSlug} onChange={(event) => setBrandSlug(event.target.value)} />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep("project")}>
                Back
              </Button>
              <Button onClick={() => void createBrand()} disabled={loading}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "profile" ? (
        <Card>
          <CardHeader>
            <CardTitle>Essential brand profile</CardTitle>
            <CardDescription>These fields can be completed later, but help future AI workflows.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Short description" value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} />
            <Input label="Target audience" value={targetAudience} onChange={(event) => setTargetAudience(event.target.value)} />
            <Input label="Value proposition" value={valueProposition} onChange={(event) => setValueProposition(event.target.value)} />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep("brand")}>
                Back
              </Button>
              <Button variant="outline" onClick={() => setStep("complete")}>
                Skip for now
              </Button>
              <Button onClick={() => void saveProfile()} disabled={loading}>
                Save and continue
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "complete" ? (
        <Card>
          <CardHeader>
            <CardTitle>Workspace ready</CardTitle>
            <CardDescription>Your organisation, project, and brand are configured.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void finishOnboarding()} disabled={loading}>
              Enter dashboard
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
