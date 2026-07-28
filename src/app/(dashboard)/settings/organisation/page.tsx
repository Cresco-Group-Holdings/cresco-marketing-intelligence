"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";

export default function OrganisationSettingsPage() {
  const { preference } = useWorkspace();
  const [organisation, setOrganisation] = useState<Record<string, string | null>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!preference.currentOrganisationId) return;
    void apiFetch<{ organisation: Record<string, string | null> }>(
      `/api/organisations/${preference.currentOrganisationId}`,
      { organisationId: preference.currentOrganisationId },
    ).then((data) => setOrganisation(data.organisation));
  }, [preference.currentOrganisationId]);

  async function save() {
    if (!preference.currentOrganisationId) return;
    await apiFetch(`/api/organisations/${preference.currentOrganisationId}`, {
      method: "PATCH",
      organisationId: preference.currentOrganisationId,
      body: JSON.stringify({
        name: organisation.name,
        legalName: organisation.legalName,
        website: organisation.website,
        industry: organisation.industry,
        countryCode: organisation.countryCode,
        defaultTimezone: organisation.defaultTimezone,
      }),
    });
    setMessage("Organisation updated.");
  }

  return (
    <>
      <PageHeader title="Organisation settings" breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Organisation" }]} />
      <Card>
        <CardHeader><CardTitle>Organisation details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input label="Name" value={organisation.name ?? ""} onChange={(e) => setOrganisation((c) => ({ ...c, name: e.target.value }))} />
          <Input label="Legal name" value={organisation.legalName ?? ""} onChange={(e) => setOrganisation((c) => ({ ...c, legalName: e.target.value }))} />
          <Input label="Website" value={organisation.website ?? ""} onChange={(e) => setOrganisation((c) => ({ ...c, website: e.target.value }))} />
          <Input label="Industry" value={organisation.industry ?? ""} onChange={(e) => setOrganisation((c) => ({ ...c, industry: e.target.value }))} />
          <Input label="Country code" value={organisation.countryCode ?? ""} onChange={(e) => setOrganisation((c) => ({ ...c, countryCode: e.target.value }))} />
          <Input label="Timezone" value={organisation.defaultTimezone ?? ""} onChange={(e) => setOrganisation((c) => ({ ...c, defaultTimezone: e.target.value }))} />
          <Button onClick={() => void save()}>Save changes</Button>
          {message ? <p className="text-sm text-green-700">{message}</p> : null}
        </CardContent>
      </Card>
    </>
  );
}
