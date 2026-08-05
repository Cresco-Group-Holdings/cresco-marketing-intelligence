import { CampaignDetailView } from "@/components/campaigns/campaign-detail-view";

type Props = { params: Promise<{ campaignId: string }> };

export default async function CampaignDetailPage({ params }: Props) {
  const { campaignId } = await params;
  return <CampaignDetailView campaignId={campaignId} />;
}
