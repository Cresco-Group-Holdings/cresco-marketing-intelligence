import { PipelinesView } from "@/components/crm/pipelines-view";

type Props = { params: Promise<{ opportunityId: string }> };

export default async function CrmOpportunityDetailPage({ params }: Props) {
  const { opportunityId } = await params;
  return <PipelinesView mode="opportunityDetail" opportunityId={opportunityId} />;
}
