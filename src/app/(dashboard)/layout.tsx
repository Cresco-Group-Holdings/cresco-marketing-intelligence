import { DashboardShell } from "@/components/layout/dashboard-shell";
import { OnboardingRedirect } from "@/components/onboarding/onboarding-redirect";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      <OnboardingRedirect />
      {children}
    </DashboardShell>
  );
}
