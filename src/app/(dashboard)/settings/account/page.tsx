import { requireAuthenticatedUser } from "@/lib/tenancy/guards";
import { prisma } from "@/lib/database/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountSettingsForm } from "@/components/auth/account-settings-form";

export default async function AccountSettingsPage() {
  const user = await requireAuthenticatedUser();
  const profile = await prisma.userProfile.findUniqueOrThrow({
    where: { id: user.userProfileId },
  });

  return (
    <>
      <PageHeader
        title="Account"
        description="Manage your profile details and regional preferences."
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Account" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update how your name and preferences appear in the workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountSettingsForm initialProfile={profile} />
        </CardContent>
      </Card>
    </>
  );
}
