import { LongFormView } from "@/components/content/long-form-view";

type Params = { params: Promise<{ documentId: string }> };

export default async function LongFormDetailPage({ params }: Params) {
  const { documentId } = await params;
  return <LongFormView mode="detail" documentId={documentId} />;
}
