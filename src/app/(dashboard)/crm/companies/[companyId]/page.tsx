import { CrmView } from "@/components/crm/crm-view";

type Props = { params: Promise<{ companyId: string }> };

export default async function CrmCompanyDetailPage({ params }: Props) {
  const { companyId } = await params;
  return <CrmView mode="companyDetail" companyId={companyId} />;
}
