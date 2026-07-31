import { GoogleAdsManagementView } from "@/components/advertising/google-ads-management-view";

type Props = { params: Promise<{ campaignId: string }> };

export default async function GoogleAdsCampaignPage({ params }: Props) {
  const { campaignId } = await params;
  return <GoogleAdsManagementView mode="campaign-detail" campaignId={campaignId} />;
}
