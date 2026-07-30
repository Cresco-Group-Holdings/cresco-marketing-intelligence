"use client";

import { useSearchParams } from "next/navigation";
import { RankTrackingView } from "@/components/seo/rank-tracking-view";

export default function RankingsPage() {
  const params = useSearchParams();
  return <RankTrackingView mode="overview" projectId={params.get("project") ?? undefined} />;
}
