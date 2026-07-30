"use client";

import { useSearchParams } from "next/navigation";
import { InternalLinksView } from "@/components/seo/internal-links-view";

export default function InternalLinksRecommendationsPage() {
  const params = useSearchParams();
  return <InternalLinksView mode="recommendations" graphId={params.get("graph") ?? undefined} />;
}
