import { MetaAdsManagementView } from "@/components/advertising/meta-ads-management-view";

type Props = { params: Promise<{ campaignId: string }> };

export default async function MetaAdsCampaignPage({ params }: Props) {
  const { campaignId } = await params;
  return <MetaAdsManagementView mode="campaign-detail" campaignId={campaignId} />;
}
