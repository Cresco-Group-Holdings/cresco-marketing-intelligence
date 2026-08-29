import Link from "next/link";
import { MarketingShell } from "@/components/layout/marketing-shell";

export type LegalSection = {
  title: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
};

type LegalPageProps = {
  title: string;
  description: string;
  lastUpdated: string;
  sections: readonly LegalSection[];
};

export function LegalPage({ title, description, lastUpdated, sections }: LegalPageProps) {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Link href="/" className="text-sm font-medium text-foreground-muted hover:text-foreground">
          ← Back to home
        </Link>
        <h1 className="mt-6 text-3xl font-semibold text-foreground">{title}</h1>
        <p className="mt-3 text-sm text-foreground-muted">{description}</p>
        <p className="mt-2 text-xs text-foreground-subtle">Last updated: {lastUpdated}</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-foreground-muted">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-3">
                  {paragraph}
                </p>
              ))}
              {section.bullets ? (
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </article>
    </MarketingShell>
  );
}
