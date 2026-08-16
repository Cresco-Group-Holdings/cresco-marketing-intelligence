import { requireAuthenticatedUser } from "@/lib/tenancy/guards";
import { CommandCentreDashboard } from "@/components/marketing/command-centre-dashboard";
import { marketingCommandCentreService } from "@/server/services/marketing-command-centre-service";

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();
  const data = await marketingCommandCentreService.getDashboard(user.userProfileId);

  return <CommandCentreDashboard data={data} />;
}
