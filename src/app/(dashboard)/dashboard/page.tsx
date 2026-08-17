import { Suspense } from "react";
import { CommandCentreDashboard } from "@/components/marketing/command-centre-dashboard";
import { DashboardSkeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <CommandCentreDashboard />
    </Suspense>
  );
}
