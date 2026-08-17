import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_NAME } from "@/lib/constants";

const features = [
  {
    title: "Unified Marketing Workspace",
    description:
      "Bring planning, production, publishing, and reporting into one operating layer for marketing teams.",
    comingSoon: false,
  },
  {
    title: "AI Content Production",
    description:
      "Prepare briefs, drafts, and campaign assets with governed AI workflows across brands and projects.",
    comingSoon: true,
  },
  {
    title: "Social Media Distribution",
    description:
      "Coordinate channel-ready content and publishing workflows once connectors are configured.",
    comingSoon: true,
  },
  {
    title: "Marketing Intelligence",
    description:
      "Connect performance signals from websites, search, email, and paid media into actionable insight.",
    comingSoon: true,
  },
  {
    title: "AI Growth Recommendations",
    description:
      "Surface prioritised optimisation opportunities based on campaign data and audience signals.",
    comingSoon: true,
  },
  {
    title: "Built for multiple brands",
    description:
      "Manage organisations, projects, and brand portfolios with tenant-safe access controls.",
    comingSoon: false,
  },
];

export function MarketingLandingPage() {
  return (
    <div className="min-h-screen bg-surface-elevated text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-foreground">{APP_NAME}</p>
            <p className="text-xs text-foreground-subtle">AI Marketing & Growth Platform</p>
          </div>
          <nav aria-label="Public navigation" className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sign in
            </Link>
            <ButtonLink href="/signup" size="sm">
              Start building
            </ButtonLink>
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b border-border bg-surface-subtle">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-foreground-subtle">
                Cresco Marketing Intelligence
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Turn marketing data into growth.
              </h1>
              <p className="mt-6 text-lg text-foreground-muted">
                Plan, create, publish and optimise your marketing from one AI-powered workspace.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/signup" size="lg">
                  Start building
                </ButtonLink>
                <ButtonLink href="/dashboard" variant="outline" size="lg">
                  View platform
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-2xl font-semibold text-foreground">Platform capabilities</h2>
            <p className="mt-3 text-foreground-muted">
              The foundation is live. Integrations and automation modules will roll out in phased
              releases.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-xl border border-border bg-surface-elevated p-6 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                  {feature.comingSoon ? <Badge variant="warning">Coming soon</Badge> : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-foreground-muted">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-foreground-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Cresco Group. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground-muted">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground-muted">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
