import { requireAuthenticatedUser } from "@/lib/tenancy/guards";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionsSettings } from "@/components/auth/sessions-settings";

export default async function SessionsSettingsPage() {
  await requireAuthenticatedUser();

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Review your active session and revoke access when needed."
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Sessions" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>
            Sessions are stored in secure HttpOnly cookies and refreshed automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SessionsSettings />
        </CardContent>
      </Card>
    </>
  );
}
