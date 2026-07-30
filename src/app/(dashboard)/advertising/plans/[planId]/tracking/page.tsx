import { CampaignPlanView } from "@/components/advertising/campaign-plan-view";

type Props = { params: Promise<{ planId: string }> };

export default async function AdvertisingPlanTrackingPage({ params }: Props) {
  const { planId } = await params;
  return <CampaignPlanView mode="tracking" planId={planId} />;
}
