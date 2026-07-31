import { CrmView } from "@/components/crm/crm-view";

type Props = { params: Promise<{ leadId: string }> };

export default async function CrmLeadDetailPage({ params }: Props) {
  const { leadId } = await params;
  return <CrmView mode="leadDetail" leadId={leadId} />;
}
