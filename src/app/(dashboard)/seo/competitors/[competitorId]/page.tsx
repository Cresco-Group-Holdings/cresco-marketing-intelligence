import { CompetitorView } from "@/components/seo/competitor-view";

type Props = { params: Promise<{ competitorId: string }> };

export default async function CompetitorDetailPage({ params }: Props) {
  const { competitorId } = await params;
  return <CompetitorView mode="detail" competitorId={competitorId} />;
}
