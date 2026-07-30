import { TopicStrategyView } from "@/components/seo/topic-strategy-view";

type Props = { params: Promise<{ clusterId: string }> };

export default async function ClusterDetailPage({ params }: Props) {
  const { clusterId } = await params;
  return <TopicStrategyView mode="detail" clusterId={clusterId} />;
}
