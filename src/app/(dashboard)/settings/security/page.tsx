import { requireAuthenticatedUser } from "@/lib/tenancy/guards";
import { authService } from "@/server/services/auth-service";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SecuritySettingsForm } from "@/components/auth/security-settings-form";

export default async function SecuritySettingsPage() {
  await requireAuthenticatedUser();
  const { identities } = await authService.getCurrentSession();
  const hasPasswordIdentity = identities.some((identity) => identity.provider === "email");

  return (
    <>
      <PageHeader
        title="Security"
        description="Manage passwords and connected sign-in providers."
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Security" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Account security</CardTitle>
          <CardDescription>Protect access to your account and connected providers.</CardDescription>
        </CardHeader>
        <CardContent>
          <SecuritySettingsForm identities={identities} hasPasswordIdentity={hasPasswordIdentity} />
        </CardContent>
      </Card>
    </>
  );
}
