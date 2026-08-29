import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { MarketingShell } from "@/components/layout/marketing-shell";

export const metadata: Metadata = {
  title: "Product",
  description:
    "Explore Cresco Marketing Intelligence — Command Centre, Content Studio, Organic Social, Analytics, and Automations.",
};

const modules = [
  {
    title: "Command Centre",
    description:
      "KPIs, today's priorities, Marketing Health, and evidence-backed recommendations in one executive view.",
  },
  {
    title: "Advertising",
    description:
      "Paid media performance, campaigns, creatives, audiences, and budget intelligence with real account state.",
  },
  {
    title: "Organic Social",
    description:
      "Organic analytics, winning content, publishing, and growth opportunities across connected social accounts.",
  },
  {
    title: "Content Studio",
    description:
      "Brand Knowledge → AI Brief → Master Content → Channel Variants → Compliance → Approval → Publishing.",
  },
  {
    title: "Analytics & Attribution",
    description:
      "Unified analytics with explicit model, lookback, coverage, and unattributed portions — no hidden gaps.",
  },
  {
    title: "Cresco Intelligence & Automations",
    description:
      "Recommendations linked to evidence, plus scheduled monitoring, alerts, and approved publishing workflows.",
  },
] as const;

export default function ProductPage() {
  return (
    <MarketingShell activeNav="product">
      <section className="border-b border-border bg-surface-subtle">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">
              One product for the full marketing loop
            </h1>
            <p className="mt-4 text-lg text-foreground-muted">
              Cresco is an operating system for marketing teams — connect your stack, understand
              performance, create brand-aware content, execute with approval, and measure what
              matters.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 md:grid-cols-2">
          {modules.map((module) => (
            <article
              key={module.title}
              className="rounded-xl border border-border bg-surface-elevated p-6 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-foreground">{module.title}</h2>
              <p className="mt-3 text-sm leading-6 text-foreground-muted">{module.description}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-surface-subtle p-8">
          <h2 className="text-xl font-semibold text-foreground">Trust & security</h2>
          <ul className="mt-4 space-y-2 text-sm text-foreground-muted">
            <li>Secure OAuth provider connections with encrypted credentials</li>
            <li>Tenant isolation across organisations, projects, and brands</li>
            <li>Human approval controls before publishing</li>
            <li>Data and privacy controls in Settings</li>
          </ul>
          <p className="mt-4 text-xs text-foreground-subtle">
            Cresco does not claim certifications it does not hold. Security documentation is
            available on request.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/signup" size="lg">
            Start using Cresco
          </ButtonLink>
          <ButtonLink href="/pricing" variant="outline" size="lg">
            View pricing
          </ButtonLink>
        </div>
      </section>
    </MarketingShell>
  );
}
