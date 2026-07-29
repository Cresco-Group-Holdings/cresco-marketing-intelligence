import { SocialReportsView } from "@/components/analytics/social-reports-view";

type Props = { params: Promise<{ reportId: string }> };

export default async function SocialReportPreviewPage({ params }: Props) {
  const { reportId } = await params;
  return <SocialReportsView mode="preview" reportId={reportId} />;
}
