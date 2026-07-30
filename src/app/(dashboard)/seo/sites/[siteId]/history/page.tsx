import { SeoView } from "@/components/seo/seo-view";

type Props = { params: Promise<{ siteId: string }> };

export default async function SeoSiteHistoryPage({ params }: Props) {
  const { siteId } = await params;
  return <SeoView mode="history" siteId={siteId} />;
}
