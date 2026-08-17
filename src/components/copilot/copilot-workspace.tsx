"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
      setError(err instanceof Error ? err.message : "Failed to reach Cresco Copilot.");
    } finally {
      setLoading(false);
    }
  };

  const starters = getStarterQuestions("copilot");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cresco Copilot"
        description="Longer investigations, daily briefs, and evidence-based marketing decisions."
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
                  className="block rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-border-strong"
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
              <div className="mt-4 flex flex-wrap gap-2">
                {starters.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-foreground-muted hover:text-foreground"
                    onClick={() => void submit(starter)}
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface-elevated p-5">
              <ResponseView response={response} />
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
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
            <div className="mt-3 flex justify-end">
              <Button type="submit" disabled={loading || !question.trim()}>
                {loading ? "Thinking..." : "Ask Cresco"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
