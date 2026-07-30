import { CampaignsView } from "@/components/email/campaigns-view";

type Props = { params: Promise<{ campaignId: string }> };

export default async function EmailCampaignAnalyticsPage({ params }: Props) {
  const { campaignId } = await params;
  return <CampaignsView mode="analytics" campaignId={campaignId} />;
}
