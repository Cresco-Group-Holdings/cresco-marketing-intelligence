import { headers } from "next/headers";
import Link from "next/link";
import { DashboardAuthGate } from "@/components/auth/dashboard-auth-gate";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { OnboardingRedirect } from "@/components/onboarding/onboarding-redirect";
import { APP_NAME } from "@/lib/constants";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/dashboard";
  const isOnboarding = pathname.startsWith("/onboarding");

  if (isOnboarding) {
    return (
      <DashboardAuthGate pathname={pathname}>
        <div className="min-h-screen bg-slate-50">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
              <Link href="/" className="text-sm font-semibold text-slate-900">
                {APP_NAME}
              </Link>
              <p className="text-sm text-slate-600">Workspace onboarding</p>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
        </div>
      </DashboardAuthGate>
    );
  }

  return (
    <DashboardAuthGate pathname={pathname}>
      <DashboardShell>
        <OnboardingRedirect />
        {children}
      </DashboardShell>
    </DashboardAuthGate>
  );
}
