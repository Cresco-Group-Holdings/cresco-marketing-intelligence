import { CrmView } from "@/components/crm/crm-view";

type Props = { params: Promise<{ contactId: string }> };

export default async function CrmContactDetailPage({ params }: Props) {
  const { contactId } = await params;
  return <CrmView mode="contactDetail" contactId={contactId} />;
}
