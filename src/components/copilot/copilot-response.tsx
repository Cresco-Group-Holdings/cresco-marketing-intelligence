"use client";

import Link from "next/link";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import type { CopilotResponse } from "@/lib/copilot/types";
import { cn } from "@/lib/utils";

function ConfidenceBadge({ response }: { response: CopilotResponse }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
        response.confidence.level === "high" && "bg-success-muted text-success",
        response.confidence.level === "moderate" && "bg-warning-muted text-warning",
        (response.confidence.level === "limited" || response.confidence.level === "insufficient") &&
          "bg-surface-hover text-foreground-muted",
      )}
    >
      {response.confidence.label}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
      {children}
    </p>
  );
}

function BriefReport({ sections }: { sections: NonNullable<CopilotResponse["briefSections"]> }) {
  return (
    <article className="space-y-6">
      <header className="border-b border-border pb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ai-accent">
          Daily Marketing Brief
        </p>
        <h3 className="mt-1 text-lg font-semibold text-foreground">Executive summary</h3>
      </header>
      {sections.map((section) =>
        section.items.length > 0 ? (
          <section key={section.title}>
            <SectionLabel>{section.title}</SectionLabel>
            <ul className="mt-2 space-y-2">
              {section.items.map((item) => (
                <li key={item} className="text-sm text-foreground-muted">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </article>
  );
}

function EvidencePanel({ evidence }: { evidence: CopilotResponse["evidence"] }) {
  return (
    <ul className="space-y-2">
      {evidence.map((item) => (
        <li key={item.id} className="rounded-lg border border-border bg-surface px-3 py-2.5 text-xs">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-foreground">{item.label}</span>
            {item.entityHref ? (
              <Link href={item.entityHref} className="text-paid-accent hover:underline">
                Open
              </Link>
            ) : null}
          </div>
          <p className="mt-1 font-medium text-foreground">
            {item.metric ? `${item.metric}: ` : ""}
            {item.value}
            {item.previousValue != null ? (
              <span className="font-normal text-foreground-muted"> · Previous: {item.previousValue}</span>
            ) : null}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-foreground-subtle">
            {item.dateRange ? (
              <span>
                Period: {item.dateRange.from} – {item.dateRange.to}
              </span>
            ) : null}
            {item.freshness ? <span>Updated: {item.freshness}</span> : null}
            {item.source ? <span>Source: {item.source}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ResponseView({
  response,
  showActions = false,
  userQuestion,
}: {
  response: CopilotResponse;
  showActions?: boolean;
  userQuestion?: string;
}) {
  const [showEvidence, setShowEvidence] = useState(false);

  if (response.intent === "brief" && response.briefSections?.length) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <ConfidenceBadge response={response} />
        </div>
        {userQuestion ? (
          <div className="rounded-lg bg-surface-subtle px-3 py-2 text-sm text-foreground">
            {userQuestion}
          </div>
        ) : null}
        <BriefReport sections={response.briefSections} />
        {response.limitations.length > 0 ? (
          <section>
            <SectionLabel>Limitations</SectionLabel>
            <ul className="mt-2 space-y-1 text-xs text-warning">
              {response.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {showActions && response.suggestedActions.length > 0 ? (
          <section className="border-t border-border pt-4">
            <SectionLabel>Actions</SectionLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {response.suggestedActions.map((action) =>
                action.href ? (
                  <ButtonLink key={action.id} href={action.href} variant="outline" size="sm">
                    {action.label}
                  </ButtonLink>
                ) : null,
              )}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ConfidenceBadge response={response} />
        <span className="text-[11px] text-foreground-subtle">{response.outputSource}</span>
      </div>

      {userQuestion ? (
        <div className="ml-auto max-w-[90%] rounded-lg bg-surface-subtle px-3 py-2 text-sm text-foreground">
          {userQuestion}
        </div>
      ) : null}

      <div className="space-y-4 border-l-2 border-ai-accent/30 pl-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{response.answer}</p>

        {response.facts.length > 0 ? (
          <section>
            <SectionLabel>Fact</SectionLabel>
            <ul className="mt-2 space-y-1.5">
              {response.facts.map((fact) => (
                <li key={fact.id} className="text-sm text-foreground-muted">
                  {fact.statement}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {response.inferences.length > 0 ? (
          <section>
            <SectionLabel>Inference</SectionLabel>
            <ul className="mt-2 space-y-1.5">
              {response.inferences.map((item) => (
                <li key={item.id} className="text-sm text-foreground-muted">
                  {item.statement}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {response.recommendations.length > 0 ? (
          <section>
            <SectionLabel>Recommendation</SectionLabel>
            <ul className="mt-2 space-y-1.5">
              {response.recommendations.map((item) => (
                <li key={item.id} className="text-sm text-foreground">
                  {item.statement}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {response.limitations.length > 0 ? (
        <ul className="space-y-1 text-xs text-warning">
          {response.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      {response.evidence.length > 0 ? (
        <section className="border-t border-border pt-4">
          <button
            type="button"
            className="text-xs font-medium text-foreground-muted transition-colors hover:text-foreground"
            onClick={() => setShowEvidence((value) => !value)}
          >
            {showEvidence ? "Hide evidence" : "View evidence"}
          </button>
          {showEvidence ? (
            <div className="mt-3">
              <SectionLabel>Evidence</SectionLabel>
              <div className="mt-2">
                <EvidencePanel evidence={response.evidence} />
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {showActions && response.suggestedActions.length > 0 ? (
        <section className="border-t border-border pt-4">
          <SectionLabel>Actions</SectionLabel>
          <div className="mt-3 flex flex-wrap gap-2">
            {response.suggestedActions.map((action) =>
              action.href ? (
                <ButtonLink key={action.id} href={action.href} variant="outline" size="sm">
                  {action.label}
                </ButtonLink>
              ) : null,
            )}
          </div>
        </section>
      ) : null}

      {response.followUpQuestions.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {response.followUpQuestions.map((question) => (
            <span
              key={question}
              className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-foreground-muted"
            >
              {question}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
