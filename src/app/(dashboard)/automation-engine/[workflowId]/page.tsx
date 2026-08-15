import { AutomationEngineView } from "@/components/automation-engine/automation-engine-view";

type Props = { params: Promise<{ workflowId: string }> };

export default async function AutomationEngineDetailPage({ params }: Props) {
  const { workflowId } = await params;
  return <AutomationEngineView mode="detail" workflowId={workflowId} />;
}
