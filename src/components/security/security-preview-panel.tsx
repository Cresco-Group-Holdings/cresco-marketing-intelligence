"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import type { SecurityPreviewState } from "@/lib/security/visual-preview-fixture";

function AlertBanner({ tone, message }: { tone: "warning" | "error" | "info"; message: string }) {
  const classes =
    tone === "error"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : tone === "warning"
        ? "border-warning/30 bg-warning-muted text-foreground"
        : "border-border bg-surface text-foreground-muted";

  return <div className={`rounded-lg border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}

export function SecurityPreviewPanel({ state }: { state: SecurityPreviewState }) {
  return (
    <div className="space-y-6" data-visual-preview="true" data-preview-tab={state.tab}>
      <PageHeader title={state.title} description={state.description} />
      {state.alert ? <AlertBanner tone={state.alert.tone} message={state.alert.message} /> : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{state.title}</CardTitle>
          <CardDescription>Representative security state for visual QA.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.items.map((item) => (
            <div
              key={item.label}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                {item.meta ? <p className="text-xs text-foreground-subtle">{item.meta}</p> : null}
              </div>
              <p className="text-sm text-foreground-muted">{item.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
