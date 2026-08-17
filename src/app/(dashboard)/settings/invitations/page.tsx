"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";

export default function InvitationsSettingsPage() {
  const { preference } = useWorkspace();
  const [invitations, setInvitations] = useState<Array<{ id: string; email: string; role: string; status: string; expiresAt: string }>>([]);
  const [email, setEmail] = useState("");
  const [devUrl, setDevUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!preference.currentOrganisationId) return;
    void (async () => {
      const data = await apiFetch<{ invitations: typeof invitations }>(
        `/api/invitations?organisationId=${preference.currentOrganisationId}`,
        { organisationId: preference.currentOrganisationId },
      );
      setInvitations(data.invitations);
    })();
  }, [preference.currentOrganisationId]);

  async function invite() {
    if (!preference.currentOrganisationId) return;
    const data = await apiFetch<{ invitation: { id: string }; developmentInviteUrl?: string }>(
      `/api/invitations?organisationId=${preference.currentOrganisationId}`,
      {
        method: "POST",
        organisationId: preference.currentOrganisationId,
        body: JSON.stringify({ email, role: "VIEWER" }),
      },
    );
    setDevUrl(data.developmentInviteUrl ?? null);
    setEmail("");
    if (!preference.currentOrganisationId) return;
    const refreshed = await apiFetch<{ invitations: typeof invitations }>(
      `/api/invitations?organisationId=${preference.currentOrganisationId}`,
      { organisationId: preference.currentOrganisationId },
    );
    setInvitations(refreshed.invitations);
  }

  return (
    <>
      <PageHeader title="Invitations" breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Invitations" }]} />
      <Card className="mb-6">
        <CardHeader><CardTitle>Invite member</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button className="self-end" onClick={() => void invite()}>Send invitation</Button>
        </CardContent>
        {devUrl ? <CardContent className="text-sm text-foreground-muted">Development invite URL: {devUrl}</CardContent> : null}
      </Card>
      <div className="space-y-4">
        {invitations.map((invitation) => (
          <Card key={invitation.id}>
            <CardHeader><CardTitle>{invitation.email}</CardTitle></CardHeader>
            <CardContent className="text-sm text-foreground-muted">
              <p>Role: {invitation.role}</p>
              <p>Status: {invitation.status}</p>
              <p>Expires: {new Date(invitation.expiresAt).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
