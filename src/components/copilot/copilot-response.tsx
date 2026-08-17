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

export function ResponseView({
  response,
  showActions = false,
}: {
  response: CopilotResponse;
  showActions?: boolean;
}) {
  const [showEvidence, setShowEvidence] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ConfidenceBadge response={response} />
        <span className="text-[11px] text-foreground-subtle">{response.outputSource}</span>
      </div>
      <div className="whitespace-pre-wrap text-sm text-foreground">{response.answer}</div>
      {response.limitations.length > 0 ? (
        <ul className="space-y-1 text-xs text-warning">
          {response.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {response.evidence.length > 0 ? (
        <div>
          <button
            type="button"
            className="text-xs font-medium text-foreground-muted hover:text-foreground"
            onClick={() => setShowEvidence((value) => !value)}
          >
            {showEvidence ? "Hide evidence" : "View evidence"}
          </button>
          {showEvidence ? (
            <ul className="mt-3 space-y-2">
              {response.evidence.map((item) => (
                <li key={item.id} className="rounded-lg border border-border bg-surface px-3 py-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-foreground">{item.label}</span>
                    {item.entityHref ? (
                      <Link href={item.entityHref} className="text-organic-accent hover:underline">
                        Open
                      </Link>
                    ) : null}
                  </div>
                  <p className="mt-1 text-foreground-muted">
                    {item.metric ? `${item.metric}: ` : ""}
                    {item.value}
                    {item.previousValue != null ? ` (was ${item.previousValue})` : ""}
                  </p>
                  {item.source ? <p className="mt-1 text-foreground-subtle">Source: {item.source}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {showActions && response.suggestedActions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {response.suggestedActions.map((action) =>
            action.href ? (
              <ButtonLink key={action.id} href={action.href} variant="outline" size="sm">
                {action.label}
              </ButtonLink>
            ) : null,
          )}
        </div>
      ) : null}
      {response.followUpQuestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
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
