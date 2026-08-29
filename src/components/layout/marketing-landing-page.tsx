import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { MarketingShell } from "@/components/layout/marketing-shell";

const productLoop = [
  {
    title: "Connect",
    description: "Bring marketing channels, analytics, and publishing accounts into one workspace.",
  },
  {
    title: "Understand",
    description: "See what changed, why it matters, and where attention is needed.",
  },
  {
    title: "Create",
    description: "Build brand-aware content from Brand Knowledge through channel variants.",
  },
  {
    title: "Execute",
    description: "Publish approved work and automate repetitive marketing operations.",
  },
  {
    title: "Measure",
    description: "Track unified analytics, attribution, and revenue with clear coverage.",
  },
  {
    title: "Learn",
    description: "Act on evidence-backed Cresco recommendations tied to real outcomes.",
  },
] as const;

const capabilities = [
  {
    title: "Command Centre",
    description:
      "Your daily operating cockpit for KPIs, priorities, Marketing Health, and recommended actions.",
  },
  {
    title: "Content Studio",
    description:
      "Brand Knowledge → AI Brief → Master Content → Channel Variants → Approval → Publishing.",
  },
  {
    title: "Organic Social",
    description:
      "Account management, winning content, publishing, and growth opportunities across organic channels.",
  },
  {
    title: "Unified Analytics",
    description:
      "Performance, attribution, funnels, and revenue with explicit freshness and coverage.",
  },
  {
    title: "Cresco Intelligence",
    description:
      "Finding → Evidence → Impact → Recommended Action. Not generic AI advice.",
  },
  {
    title: "Built for multiple brands",
    description:
      "Manage organisations, projects, and brand portfolios with tenant-safe access controls.",
  },
] as const;

export function MarketingLandingPage() {
  return (
    <MarketingShell activeNav="home">
      <section className="border-b border-border bg-surface-subtle">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-foreground-subtle">
              Cresco Marketing Intelligence
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Connect your marketing stack. Understand what drives growth. Know what to do next.
            </h1>
            <p className="mt-6 text-lg text-foreground-muted">
              For marketing teams and founders who need one place to connect channels, create
              brand-aware content, publish with approval, and measure what actually works.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/signup" size="lg">
                Start using Cresco
              </ButtonLink>
              <ButtonLink href="/product" variant="outline" size="lg">
                View product
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-semibold text-foreground">One operating system for marketing</h2>
          <p className="mt-3 text-foreground-muted">
            Cresco connects your stack, surfaces what changed, and helps your team create, publish,
            and measure with confidence.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {productLoop.map((step) => (
            <article
              key={step.title}
              className="rounded-xl border border-border bg-surface-elevated p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-foreground-muted">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface-subtle">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-2xl font-semibold text-foreground">Platform capabilities</h2>
            <p className="mt-3 text-foreground-muted">
              Launch-ready modules designed to work together — not as disconnected tools.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {capabilities.map((feature) => (
              <article
                key={feature.title}
                className="rounded-xl border border-border bg-surface-elevated p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-foreground-muted">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-border bg-surface-elevated p-8 sm:p-10">
          <h2 className="text-2xl font-semibold text-foreground">Ready to see Cresco in action?</h2>
          <p className="mt-3 max-w-2xl text-foreground-muted">
            Start with a free evaluation or begin a trial. Connect your marketing stack and reach
            your Command Centre in minutes.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/signup" size="lg">
              Start using Cresco
            </ButtonLink>
            <Link
              href="/pricing"
              className="inline-flex items-center text-sm font-medium text-foreground-muted hover:text-foreground"
            >
              View pricing →
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
