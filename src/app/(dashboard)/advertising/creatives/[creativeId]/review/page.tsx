import { AdvertisingCreativeStudioView } from "@/components/advertising/creative-studio-view";

type Props = { params: Promise<{ creativeId: string }> };

export default async function AdvertisingCreativeReviewPage({ params }: Props) {
  const { creativeId } = await params;
  return <AdvertisingCreativeStudioView mode="review" creativeId={creativeId} />;
}
