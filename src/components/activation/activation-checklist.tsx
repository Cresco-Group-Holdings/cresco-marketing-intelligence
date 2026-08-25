"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivationChecklist, ActivationChecklistItem } from "@/lib/activation/checklist";

function checklistIcon(status: ActivationChecklistItem["status"]): string {
  switch (status) {
    case "complete":
      return "✓";
    case "in_progress":
      return "⏳";
    case "waiting":
      return "⏳";
    case "requires_admin":
      return "🔒";
    case "skipped":
      return "—";
    default:
      return "⬜";
  }
}

function ChecklistSection({
  title,
  description,
  items,
  collapsed = false,
}: {
  title: string;
  description: string;
  items: ActivationChecklistItem[];
  collapsed?: boolean;
}) {
  if (collapsed && items.every((item) => item.status === "complete")) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3" role="list" aria-label={title}>
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-border px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span aria-hidden="true">{checklistIcon(item.status)}</span>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  {item.status === "in_progress" || item.status === "waiting" ? (
                    <Badge variant="warning">
                      {item.status === "waiting" ? "Waiting" : "In progress"}
                    </Badge>
                  ) : null}
                  {item.status === "requires_admin" ? (
                    <Badge variant="muted">Requires admin</Badge>
                  ) : null}
                </div>
                {item.summary ? (
                  <p className="mt-1 text-sm text-foreground-muted">{item.summary}</p>
                ) : null}
                {item.consequence ? (
                  <p className="mt-1 text-sm text-foreground-subtle">{item.consequence}</p>
                ) : null}
              </div>
              {item.href && item.status !== "complete" && item.status !== "requires_admin" ? (
                <Link href={item.href} className="shrink-0 text-sm font-medium hover:underline">
                  Open
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

type ActivationChecklistPanelProps = {
  checklist: ActivationChecklist;
  essentialOnly?: boolean;
};

export function ActivationChecklistPanel({
  checklist,
  essentialOnly = false,
}: ActivationChecklistPanelProps) {
  const essentialComplete = checklist.essentialCompleted === checklist.essentialTotal;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Finish setting up Cresco</h2>
          <p className="text-sm text-foreground-muted">
            {checklist.essentialCompleted} of {checklist.essentialTotal} essential steps complete
          </p>
        </div>
        <ButtonLink href="/getting-started" variant="outline" size="sm">
          View setup guide
        </ButtonLink>
      </div>

      <ChecklistSection
        title="Essential setup"
        description="Complete these steps to reach your first meaningful result."
        items={checklist.essential}
      />

      {!essentialOnly ? (
        <ChecklistSection
          title="Improve your Cresco setup"
          description="Optional steps that strengthen intelligence and automation."
          items={checklist.optional}
          collapsed={essentialComplete}
        />
      ) : null}
    </div>
  );
}
