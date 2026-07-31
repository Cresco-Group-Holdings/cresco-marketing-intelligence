import { AdvertisingExperimentsView } from "@/components/advertising/advertising-experiments-view";

type Props = { params: Promise<{ experimentId: string }> };

export default async function AdvertisingExperimentDetailPage({ params }: Props) {
  const { experimentId } = await params;
  return <AdvertisingExperimentsView mode="detail" experimentId={experimentId} />;
}
