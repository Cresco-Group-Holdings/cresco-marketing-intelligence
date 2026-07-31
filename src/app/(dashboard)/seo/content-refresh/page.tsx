"use client";

import { useSearchParams } from "next/navigation";
import { RankTrackingView } from "@/components/seo/rank-tracking-view";

export default function ContentRefreshPage() {
  const params = useSearchParams();
  return <RankTrackingView mode="refresh" projectId={params.get("project") ?? undefined} />;
}
