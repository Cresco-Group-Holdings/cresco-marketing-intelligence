import { LongFormView } from "@/components/content/long-form-view";

type Params = { params: Promise<{ documentId: string }> };

export default async function LongFormReviewPage({ params }: Params) {
  const { documentId } = await params;
  return <LongFormView mode="review" documentId={documentId} />;
}
