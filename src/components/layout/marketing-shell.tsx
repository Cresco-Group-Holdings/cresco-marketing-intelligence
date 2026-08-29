import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

type MarketingShellProps = {
  children: React.ReactNode;
  activeNav?: "home" | "product" | "pricing";
};

const NAV_LINKS = [
  { href: "/product", label: "Product", key: "product" as const },
  { href: "/pricing", label: "Pricing", key: "pricing" as const },
] as const;

export function MarketingShell({ children, activeNav }: MarketingShellProps) {
  return (
    <div className="min-h-screen bg-surface-elevated text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <p className="text-sm font-semibold text-foreground">{APP_NAME}</p>
            <p className="text-xs text-foreground-subtle">Connect. Understand. Create. Measure.</p>
          </Link>
          <nav aria-label="Public navigation" className="flex items-center gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={activeNav === link.key ? "page" : undefined}
                className={`text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  activeNav === link.key
                    ? "text-foreground"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="text-sm font-medium text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sign in
            </Link>
            <ButtonLink href="/signup" size="sm">
              Start using Cresco
            </ButtonLink>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-foreground-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p>© {new Date().getFullYear()} Cresco Group. All rights reserved.</p>
            <p className="mt-1">
              <a href="mailto:support@cresco.group" className="hover:text-foreground-muted">
                support@cresco.group
              </a>
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-foreground-muted">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground-muted">
              Terms
            </Link>
            <Link href="/cookies" className="hover:text-foreground-muted">
              Cookies
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
