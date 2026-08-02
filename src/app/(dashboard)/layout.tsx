import { headers } from "next/headers";
import { DashboardAuthGate } from "@/components/auth/dashboard-auth-gate";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { isOnboardingRoute } from "@/lib/auth/routes";
import { PATHNAME_HEADER } from "@/lib/middleware/pathname";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get(PATHNAME_HEADER) ?? "/dashboard";
  const isOnboarding = isOnboardingRoute(pathname);

  return (
    <DashboardAuthGate pathname={pathname}>
      {isOnboarding ? children : <DashboardShell>{children}</DashboardShell>}
    </DashboardAuthGate>
  );
}
