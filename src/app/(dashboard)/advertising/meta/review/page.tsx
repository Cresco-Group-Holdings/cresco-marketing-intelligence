"use client";

import { useSearchParams } from "next/navigation";
import { MetaAdsManagementView } from "@/components/advertising/meta-ads-management-view";

export default function MetaAdsReviewPage() {
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draftId") ?? undefined;
  return <MetaAdsManagementView mode="review" reviewDraftId={draftId} />;
}
