"use client";

import { useParams, useSearchParams } from "next/navigation";
import { RankTrackingView } from "@/components/seo/rank-tracking-view";

export default function ContentRefreshDetailPage() {
  const params = useParams<{ candidateId: string }>();
  const searchParams = useSearchParams();
  return (
    <RankTrackingView
      mode="refresh-detail"
      candidateId={params.candidateId}
      projectId={searchParams.get("project") ?? undefined}
    />
  );
}
