import { MarketingLeadsView } from "@/components/leads/marketing-leads-view";

type Props = { params: Promise<{ leadId: string }> };

export default async function LeadDetailPage({ params }: Props) {
  const { leadId } = await params;
  return <MarketingLeadsView mode="detail" leadId={leadId} />;
}
