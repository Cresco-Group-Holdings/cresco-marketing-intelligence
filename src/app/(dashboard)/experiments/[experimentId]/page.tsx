import { SocialExperimentsView } from "@/components/experiments/social-experiments-view";

type PageProps = { params: Promise<{ experimentId: string }> };

export default async function ExperimentDetailPage({ params }: PageProps) {
  const { experimentId } = await params;
  return <SocialExperimentsView experimentId={experimentId} />;
}
