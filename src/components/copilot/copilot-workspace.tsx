"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { useCopilot } from "@/components/copilot/copilot-provider";
import { ResponseView } from "@/components/copilot/copilot-response";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { getStarterQuestions } from "@/lib/copilot/starter-questions";
import type { CopilotResponse } from "@/lib/copilot/types";

type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
  lastMessage: string;
};

export function CopilotWorkspace() {
  const { pageContext, conversationId, setConversationId } = useCopilot();
  const [question, setQuestion] = useState("");
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CopilotResponse | null>(null);
  const [history, setHistory] = useState<ConversationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const result = await apiFetch<{ conversations: ConversationSummary[] }>("/api/copilot/query");
    setHistory(result.conversations);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const submit = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setLastQuestion(trimmed);
    try {
      const result = await apiFetch<{ response: CopilotResponse; conversationId: string }>(
        "/api/copilot/query",
        {
          method: "POST",
          body: JSON.stringify({
            question: trimmed,
            conversationId: conversationId ?? undefined,
            pageContext: { ...pageContext, route: "/copilot", module: "copilot" },
          }),
        },
      );
      setConversationId(result.conversationId);
      setResponse(result.response);
      setQuestion("");
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach Ask Cresco.");
    } finally {
      setLoading(false);
    }
  };

  const starters = getStarterQuestions("copilot");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ask Cresco"
        description="Evidence-based marketing intelligence, daily briefs, and recommended actions."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void submit("Give me today's marketing brief.")}
            disabled={loading}
          >
            <Sparkles className="mr-2 h-4 w-4 text-ai-accent" aria-hidden="true" />
            Daily brief
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-xl border border-border bg-surface-elevated p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Conversations</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setConversationId(null);
                setResponse(null);
                setLastQuestion(null);
              }}
            >
              New
            </Button>
          </div>
          <ul className="mt-3 space-y-2">
            {history.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/copilot?conversation=${conversation.id}`}
                  className="block rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors hover:border-border-strong hover:bg-surface-hover"
                >
                  <p className="font-medium text-foreground">{conversation.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-foreground-subtle">
                    {conversation.lastMessage}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <section className="space-y-4">
          {!response ? (
            <div className="rounded-xl border border-border bg-surface-elevated p-5">
              <p className="text-sm text-foreground-muted">
                Ask about ROAS, budget, content, attribution, revenue, or today&apos;s priorities.
              </p>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
                Suggested questions
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {starters.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs text-foreground-muted transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-foreground"
                    onClick={() => void submit(starter)}
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface-elevated p-5">
              <ResponseView
                response={response}
                showActions
                userQuestion={lastQuestion ?? undefined}
              />
            </div>
          )}

          <form
            className="rounded-xl border border-border bg-surface-elevated p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit(question);
            }}
          >
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={4}
              placeholder="Which campaigns are wasting budget?"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
            <div className="mt-3 flex justify-end">
              <Button type="submit" disabled={loading || !question.trim()}>
                {loading ? "Analysing…" : "Ask Cresco"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
