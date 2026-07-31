import { OnPageView } from "@/components/seo/on-page-view";

type Params = { params: Promise<{ pageId: string }> };

export default async function OnPageComparePage({ params }: Params) {
  const { pageId } = await params;
  return <OnPageView mode="compare" pageId={pageId} />;
}
