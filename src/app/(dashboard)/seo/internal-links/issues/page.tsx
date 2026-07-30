"use client";

import { useSearchParams } from "next/navigation";
import { InternalLinksView } from "@/components/seo/internal-links-view";

export default function InternalLinksIssuesPage() {
  const params = useSearchParams();
  return <InternalLinksView mode="issues" graphId={params.get("graph") ?? undefined} />;
}
