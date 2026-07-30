"use client";

import { useParams, useSearchParams } from "next/navigation";
import { InternalLinksView } from "@/components/seo/internal-links-view";

export default function InternalLinksPageDetailPage() {
  const searchParams = useSearchParams();
  const params = useParams<{ pageId: string }>();
  return (
    <InternalLinksView
      mode="page"
      pageId={params.pageId}
      graphId={searchParams.get("graph") ?? undefined}
    />
  );
}
