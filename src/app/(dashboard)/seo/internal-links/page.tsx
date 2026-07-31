"use client";

import { useSearchParams } from "next/navigation";
import { InternalLinksView } from "@/components/seo/internal-links-view";

export default function InternalLinksPage() {
  const params = useSearchParams();
  return <InternalLinksView mode="list" graphId={params.get("graph") ?? undefined} />;
}
