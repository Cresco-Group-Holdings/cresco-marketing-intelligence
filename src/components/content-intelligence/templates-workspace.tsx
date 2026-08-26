"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { CONTENT_TEMPLATES } from "@/lib/content-intelligence/templates";
import { resolveObjectiveLabel } from "@/lib/content-intelligence/objectives";

export function TemplatesWorkspace() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Templates"
        description="Reusable structures combined with Brand Knowledge at generation time."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {CONTENT_TEMPLATES.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <CardTitle className="text-base">{template.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-foreground-muted">{template.description}</p>
              <p className="text-xs text-foreground-subtle">
                Objective: {resolveObjectiveLabel(template.objective)} · Channels:{" "}
                {template.suggestedChannels.join(", ")}
              </p>
              <ul className="space-y-1 text-xs text-foreground-muted">
                {template.structure.sections.map((section) => (
                  <li key={section.key}>
                    {section.label}
                    {section.required ? " *" : ""}: {section.guidance}
                  </li>
                ))}
              </ul>
              <ButtonLink
                href={`/content/studio/create?template=${template.id}`}
                size="sm"
                variant="outline"
              >
                Use template
              </ButtonLink>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
