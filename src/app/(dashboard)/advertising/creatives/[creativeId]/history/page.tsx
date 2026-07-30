import { AdvertisingCreativeStudioView } from "@/components/advertising/creative-studio-view";

type Props = { params: Promise<{ creativeId: string }> };

export default async function AdvertisingCreativeHistoryPage({ params }: Props) {
  const { creativeId } = await params;
  return <AdvertisingCreativeStudioView mode="history" creativeId={creativeId} />;
}
