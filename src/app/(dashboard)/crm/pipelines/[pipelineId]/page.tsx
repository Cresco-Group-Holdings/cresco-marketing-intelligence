import { PipelinesView } from "@/components/crm/pipelines-view";

type Props = { params: Promise<{ pipelineId: string }> };

export default async function CrmPipelineDetailPage({ params }: Props) {
  const { pipelineId } = await params;
  return <PipelinesView mode="pipelineDetail" pipelineId={pipelineId} />;
}
