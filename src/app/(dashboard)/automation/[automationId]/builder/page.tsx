import { AutomationView } from "@/components/automation/automation-view";

type Props = { params: Promise<{ automationId: string }> };

export default async function AutomationBuilderPage({ params }: Props) {
  const { automationId } = await params;
  return <AutomationView mode="builder" automationId={automationId} />;
}
