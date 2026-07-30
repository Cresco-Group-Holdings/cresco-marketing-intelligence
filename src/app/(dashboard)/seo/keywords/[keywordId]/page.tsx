import { KeywordView } from "@/components/seo/keyword-view";

type Props = { params: Promise<{ keywordId: string }> };

export default async function KeywordDetailPage({ params }: Props) {
  const { keywordId } = await params;
  return <KeywordView mode="detail" keywordId={keywordId} />;
}
