import { AdvertisingCreativeStudioView } from "@/components/advertising/creative-studio-view";

type Props = { params: Promise<{ creativeId: string }> };

export default async function AdvertisingCreativeDetailPage({ params }: Props) {
  const { creativeId } = await params;
  return <AdvertisingCreativeStudioView mode="detail" creativeId={creativeId} />;
}
