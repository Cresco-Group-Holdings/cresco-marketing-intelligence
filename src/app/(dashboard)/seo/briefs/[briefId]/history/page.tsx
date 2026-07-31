import { BriefView } from "@/components/seo/brief-view";

type Props = { params: Promise<{ briefId: string }> };

export default async function BriefHistoryPage({ params }: Props) {
  const { briefId } = await params;
  return <BriefView mode="history" briefId={briefId} />;
}
