import { ScoringView } from "@/components/crm/scoring-view";

type Props = { params: Promise<{ modelId: string }> };

export default async function ScoringModelDetailPage({ params }: Props) {
  const { modelId } = await params;
  return <ScoringView mode="modelDetail" modelId={modelId} />;
}
