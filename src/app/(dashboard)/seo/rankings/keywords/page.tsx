"use client";

import { useSearchParams } from "next/navigation";
import { RankTrackingView } from "@/components/seo/rank-tracking-view";

export default function RankingsKeywordsPage() {
  const params = useSearchParams();
  return <RankTrackingView mode="keywords" projectId={params.get("project") ?? undefined} />;
}
