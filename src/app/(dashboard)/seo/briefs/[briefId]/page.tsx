import { BriefView } from "@/components/seo/brief-view";

type Props = { params: Promise<{ briefId: string }> };

export default async function BriefDetailPage({ params }: Props) {
  const { briefId } = await params;
  return <BriefView mode="detail" briefId={briefId} />;
}
