import { AdvertisingExperimentsView } from "@/components/advertising/advertising-experiments-view";

type Props = { params: Promise<{ experimentId: string }> };

export default async function AdvertisingExperimentValidityPage({ params }: Props) {
  const { experimentId } = await params;
  return <AdvertisingExperimentsView mode="validity" experimentId={experimentId} />;
}
