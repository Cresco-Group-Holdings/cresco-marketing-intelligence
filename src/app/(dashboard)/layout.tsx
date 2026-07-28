import { headers } from "next/headers";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { OnboardingRedirect } from "@/components/onboarding/onboarding-redirect";
import { DashboardAuthGate } from "@/components/auth/dashboard-auth-gate";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/dashboard";

  return (
    <DashboardAuthGate pathname={pathname}>
      <DashboardShell>
        <OnboardingRedirect />
        {children}
      </DashboardShell>
    </DashboardAuthGate>
  );
}
