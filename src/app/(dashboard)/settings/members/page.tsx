"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";

export default function MembersSettingsPage() {
  const { preference } = useWorkspace();
  const [members, setMembers] = useState<Array<{ id: string; role: string; status: string; user: { email: string; displayName?: string | null } }>>([]);

  useEffect(() => {
    if (!preference.currentOrganisationId) return;
    void apiFetch<{ members: typeof members }>(
      `/api/members?organisationId=${preference.currentOrganisationId}`,
      { organisationId: preference.currentOrganisationId },
    ).then((data) => setMembers(data.members));
  }, [preference.currentOrganisationId]);

  return (
    <>
      <PageHeader title="Members" breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Members" }]} />
      <div className="space-y-4">
        {members.map((member) => (
          <Card key={member.id}>
            <CardHeader><CardTitle>{member.user.displayName ?? member.user.email}</CardTitle></CardHeader>
            <CardContent className="text-sm text-foreground-muted">
              <p>Role: {member.role}</p>
              <p>Status: {member.status}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
