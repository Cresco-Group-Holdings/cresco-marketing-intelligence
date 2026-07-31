import { AudienceIntelligenceView } from "@/components/advertising/audience-intelligence-view";

type Props = { params: Promise<{ audienceId: string }> };

export default async function AdvertisingAudienceHistoryPage({ params }: Props) {
  const { audienceId } = await params;
  return <AudienceIntelligenceView mode="history" audienceId={audienceId} />;
}
