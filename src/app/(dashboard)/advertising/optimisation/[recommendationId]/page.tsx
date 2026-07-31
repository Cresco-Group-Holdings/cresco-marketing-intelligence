import { AdvertisingOptimisationView } from "@/components/advertising/advertising-optimisation-view";

type Props = { params: Promise<{ recommendationId: string }> };

export default async function AdvertisingOptimisationDetailPage({ params }: Props) {
  const { recommendationId } = await params;
  return <AdvertisingOptimisationView mode="detail" recommendationId={recommendationId} />;
}
