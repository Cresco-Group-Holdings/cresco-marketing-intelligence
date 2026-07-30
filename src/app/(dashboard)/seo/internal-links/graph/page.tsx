"use client";

import { useSearchParams } from "next/navigation";
import { InternalLinksView } from "@/components/seo/internal-links-view";

export default function InternalLinksGraphPage() {
  const params = useSearchParams();
  return <InternalLinksView mode="graph" graphId={params.get("graph") ?? undefined} />;
}
