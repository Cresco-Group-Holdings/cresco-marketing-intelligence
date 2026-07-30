import { CampaignPlanView } from "@/components/advertising/campaign-plan-view";

type Props = { params: Promise<{ planId: string }> };

export default async function AdvertisingPlanReviewPage({ params }: Props) {
  const { planId } = await params;
  return <CampaignPlanView mode="review" planId={planId} />;
}
