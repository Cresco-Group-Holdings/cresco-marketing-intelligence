import Link from "next/link";
import { requireAuthenticatedUser } from "@/lib/tenancy/guards";
import { workspaceService } from "@/server/services/workspace-service";
import { prisma } from "@/lib/database/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { calculateBrandProfileCompleteness } from "@/lib/brand-profile/completeness";
import { MARKETING_CHANNEL_LABELS } from "@/lib/onboarding/marketing";

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();
  const workspace = await workspaceService.getResolvedWorkspace(user.userProfileId);

  const organisation = workspace.organisations.find(
    (item) => item.id === workspace.preference.currentOrganisationId,
  );
  const project = workspace.projects.find((item) => item.id === workspace.preference.currentProjectId);
  const brand = workspace.brands.find((item) => item.id === workspace.preference.currentBrandId);

  const brandProfile = workspace.preference.currentBrandId
    ? await prisma.brandProfile.findUnique({
        where: { brandId: workspace.preference.currentBrandId },
      })
    : null;

  const objectives = workspace.preference.currentBrandId
    ? await prisma.marketingObjective.findMany({
        where: { brandId: workspace.preference.currentBrandId },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      })
    : [];

  const channelPreferences = workspace.preference.currentBrandId
    ? await prisma.brandChannelPreference.findMany({
        where: { brandId: workspace.preference.currentBrandId, enabled: true },
        orderBy: { channel: "asc" },
      })
    : [];

  const profileCompleteness = brandProfile
    ? calculateBrandProfileCompleteness(brandProfile)
    : 0;

  return (
    <>
      <PageHeader
        title="Overview"
        description="Your marketing command centre for organisations, projects, and brands."
        breadcrumbs={[{ label: "Overview" }]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Workspace configuration</CardTitle>
            <CardDescription>Current selections and onboarding-derived setup.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div>
              <p className="font-medium text-slate-900">Organisation</p>
              <p>{organisation?.name ?? "Not selected"}</p>
            </div>
            <div>
              <p className="font-medium text-slate-900">Project</p>
              <p>{project?.name ?? "Not selected"}</p>
            </div>
            <div>
              <p className="font-medium text-slate-900">Brand</p>
              <p>{brand?.name ?? "Not selected"}</p>
            </div>
            <div>
              <p className="font-medium text-slate-900">Brand profile completeness</p>
              <p>{profileCompleteness}%</p>
            </div>
            <div className="sm:col-span-2">
              <p className="font-medium text-slate-900">Marketing objectives</p>
              <p>{objectives.length > 0 ? `${objectives.length} configured` : "None configured"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="font-medium text-slate-900">Planned channels</p>
              <p>
                {channelPreferences.length > 0
                  ? channelPreferences.map((item) => MARKETING_CHANNEL_LABELS[item.channel]).join(", ")
                  : "None selected"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommended next action</CardTitle>
            <CardDescription>Move from configuration to activation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-700">
              Connect a marketing channel to start syncing performance data and campaigns.
            </p>
            <ButtonLink href="/connectors" className="w-full">
              Connect a marketing channel
            </ButtonLink>
            <div className="space-y-2 text-sm">
              <Link href="/settings/account" className="block text-slate-700 hover:underline">
                Review account settings
              </Link>
              {brand ? (
                <Link href={`/brands/${brand.id}/profile`} className="block text-slate-700 hover:underline">
                  Improve brand profile
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
