import { AutomationView } from "@/components/automation/automation-view";

type Props = { params: Promise<{ automationId: string }> };

export default async function AutomationAnalyticsPage({ params }: Props) {
  const { automationId } = await params;
  return <AutomationView mode="analytics" automationId={automationId} />;
}
