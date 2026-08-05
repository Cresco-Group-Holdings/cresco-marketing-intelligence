"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STUDIO_PIPELINE_COLUMNS } from "@/lib/content/studio-workflow";

export type StudioListItem = {
  id: string;
  title: string;
  studioType: string | null;
  status: string;
  version: number;
  contentCampaignId: string | null;
  primaryChannel: string | null;
  dueAt: string | null;
  scheduledFor: string | null;
  updatedAt: string;
  variants: Array<{ id: string; marketingChannel: string | null }>;
};

function statusVariant(status: string): "default" | "muted" | "warning" {
  if (status === "APPROVED" || status === "PUBLISHED" || status === "READY") return "default";
  if (status === "IN_REVIEW" || status === "CHANGES_REQUESTED") return "warning";
  return "muted";
}

type Props = {
  items: StudioListItem[];
  brandId: string;
};

export function ContentStudioPipeline({ items, brandId }: Props) {
  const groups = new Map<string, StudioListItem[]>();
  for (const column of STUDIO_PIPELINE_COLUMNS) {
    groups.set(column, []);
  }
  for (const item of items) {
    const list = groups.get(item.status) ?? [];
    list.push(item);
    groups.set(item.status, list);
  }

  return (
    <div className="grid gap-4 overflow-x-auto lg:grid-cols-5 xl:grid-cols-9">
      {STUDIO_PIPELINE_COLUMNS.map((column) => (
        <Card key={column} className="min-w-[200px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {column.replace(/_/g, " ")}
              <span className="ml-2 text-muted-foreground">({groups.get(column)?.length ?? 0})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(groups.get(column) ?? []).map((item) => (
              <Link
                key={item.id}
                href={`/content/studio/${item.id}`}
                className="block rounded-md border p-3 transition-colors hover:bg-muted/50"
              >
                <p className="text-sm font-medium leading-tight">{item.title}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.studioType && (
                    <Badge variant="muted" className="text-xs">
                      {item.studioType.replace(/_/g, " ")}
                    </Badge>
                  )}
                  <Badge variant={statusVariant(item.status)} className="text-xs">
                    v{item.version}
                  </Badge>
                </div>
                {item.primaryChannel && (
                  <p className="mt-1 text-xs text-muted-foreground">{item.primaryChannel}</p>
                )}
              </Link>
            ))}
            {(groups.get(column)?.length ?? 0) === 0 && (
              <p className="text-xs text-muted-foreground">No items</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
