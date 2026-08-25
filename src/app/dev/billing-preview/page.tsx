import { notFound } from "next/navigation";
import { DashboardPreviewShell } from "@/components/layout/dashboard-preview-shell";
import { BillingPreviewPanel } from "@/components/billing/billing-preview-panel";
import type { BillingPreviewState } from "@/lib/billing/billing-preview-fixture";

const VALID_STATES: BillingPreviewState[] = [
  "current-plan",
  "usage",
  "upgrade",
  "limit-reached",
  "payment-failed",
  "cancelled",
];

export default async function BillingPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const params = await searchParams;
  const state = (params.state ?? "current-plan") as BillingPreviewState;
  if (!VALID_STATES.includes(state)) {
    notFound();
  }

  return (
    <DashboardPreviewShell>
      <div data-visual-preview="true">
        <BillingPreviewPanel state={state} />
      </div>
    </DashboardPreviewShell>
  );
}
