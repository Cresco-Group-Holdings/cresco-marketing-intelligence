"use client";

import { useSearchParams } from "next/navigation";
import { RankTrackingView } from "@/components/seo/rank-tracking-view";

export default function RankingsChangesPage() {
  const params = useSearchParams();
  return <RankTrackingView mode="changes" projectId={params.get("project") ?? undefined} />;
}
