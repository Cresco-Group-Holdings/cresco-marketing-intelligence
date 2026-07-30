import { OnPageView } from "@/components/seo/on-page-view";

type Params = { params: Promise<{ pageId: string }> };

export default async function OnPageHistoryPage({ params }: Params) {
  const { pageId } = await params;
  return <OnPageView mode="history" pageId={pageId} />;
}
