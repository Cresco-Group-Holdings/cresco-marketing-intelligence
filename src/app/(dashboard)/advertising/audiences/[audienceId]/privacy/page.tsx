import { AudienceIntelligenceView } from "@/components/advertising/audience-intelligence-view";

type Props = { params: Promise<{ audienceId: string }> };

export default async function AdvertisingAudiencePrivacyPage({ params }: Props) {
  const { audienceId } = await params;
  return <AudienceIntelligenceView mode="privacy" audienceId={audienceId} />;
}
