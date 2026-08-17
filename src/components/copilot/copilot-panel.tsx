"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, RefreshCw, Sparkles, X } from "lucide-react";
import { useCopilot } from "@/components/copilot/copilot-provider";
import { ResponseView } from "@/components/copilot/copilot-response";
import { Button, ButtonLink } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { getStarterQuestions } from "@/lib/copilot/starter-questions";
import type { CopilotResponse } from "@/lib/copilot/types";

export function CopilotPanel() {
  const {
    isOpen,
    close,
    pageContext,
    conversationId,
    setConversationId,
    lastResponse,
    setLastResponse,
  } = useCopilot();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const starters = getStarterQuestions(pageContext.module);

  const submit = useCallback(
    async (value: string) => {
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
              pageContext,
            }),
          },
        );
        setConversationId(result.conversationId);
        setLastResponse(result.response);
        setQuestion("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reach Cresco Copilot.");
      } finally {
        setLoading(false);
      }
    },
    [conversationId, pageContext, setConversationId, setLastResponse],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none"
        aria-label="Close Cresco Copilot"
        onClick={close}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col border-l border-border bg-surface-elevated shadow-xl"
        aria-label="Cresco Copilot"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-organic-accent" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-foreground">Ask Cresco</p>
              <p className="text-xs text-foreground-subtle">Evidence-based marketing copilot</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ButtonLink href="/copilot" variant="ghost" size="sm">
              Open full view
            </ButtonLink>
            <Button type="button" variant="ghost" size="sm" onClick={close} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {lastResponse ? (
            <ResponseView response={lastResponse} showActions />
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-foreground-muted">
                Ask about performance, budget, content, attribution, or what to do today. Answers
                separate facts, inferences, and recommendations.
              </p>
              <div className="flex flex-wrap gap-2">
                {starters.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    className="rounded-full border border-border bg-surface px-3 py-1.5 text-left text-xs text-foreground-muted hover:border-border-strong hover:text-foreground"
                    onClick={() => void submit(starter)}
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
        </div>

        <form
          className="border-t border-border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(question);
          }}
        >
          <label className="sr-only" htmlFor="copilot-question">
            Ask Cresco
          </label>
          <textarea
            id="copilot-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={3}
            placeholder="Why did ROAS decline this month?"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setConversationId(null);
                setLastResponse(null);
              }}
            >
              New conversation
            </Button>
            <Button type="submit" size="sm" disabled={loading || !question.trim()}>
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Ask"}
            </Button>
          </div>
        </form>
      </aside>
    </>
  );
}

export function CopilotHeaderButton() {
  const { toggle } = useCopilot();
  return (
    <Button type="button" variant="outline" size="sm" onClick={toggle} className="hidden sm:inline-flex">
      <MessageSquare className="mr-2 h-4 w-4" aria-hidden="true" />
      Ask Cresco
    </Button>
  );
}
