import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-subtle">
      <header className="border-b border-border bg-surface-elevated">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-sm font-semibold text-foreground">
            {APP_NAME}
          </Link>
          <p className="text-sm text-foreground-muted">Workspace onboarding</p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
