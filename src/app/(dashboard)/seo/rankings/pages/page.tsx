"use client";

import { useSearchParams } from "next/navigation";
import { RankTrackingView } from "@/components/seo/rank-tracking-view";

export default function RankingsPagesPage() {
  const params = useSearchParams();
  return <RankTrackingView mode="pages" projectId={params.get("project") ?? undefined} />;
}
