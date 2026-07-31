import { SeoView } from "@/components/seo/seo-view";

type Props = { params: Promise<{ siteId: string }> };

export default async function SeoSiteDetailPage({ params }: Props) {
  const { siteId } = await params;
  return <SeoView mode="detail" siteId={siteId} />;
}
