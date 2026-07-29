import { ContentOperationsView } from "@/components/operations/content-operations-view";

type Props = { params: Promise<{ campaignId: string }> };

export default async function CampaignDetailPage({ params }: Props) {
  const { campaignId } = await params;
  return <ContentOperationsView mode="campaign-detail" campaignId={campaignId} />;
}
