import { notFound } from "next/navigation";
import { DashboardPreviewShell } from "@/components/layout/dashboard-preview-shell";
import { SecurityPreviewPanel } from "@/components/security/security-preview-panel";
import {
  SECURITY_PREVIEW_STATES,
  type SecurityPreviewTab,
} from "@/lib/security/visual-preview-fixture";

function resolveTab(value: string | undefined): SecurityPreviewTab {
  const tabs = Object.keys(SECURITY_PREVIEW_STATES) as SecurityPreviewTab[];
  if (value && tabs.includes(value as SecurityPreviewTab)) {
    return value as SecurityPreviewTab;
  }
  return "overview";
}

export default async function SecurityPreviewTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { tab: tabParam } = await params;
  const tab = resolveTab(tabParam);
  const state = SECURITY_PREVIEW_STATES[tab];

  return (
    <DashboardPreviewShell>
      <SecurityPreviewPanel state={state} />
    </DashboardPreviewShell>
  );
}
