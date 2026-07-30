import { LongFormView } from "@/components/content/long-form-view";

type Params = { params: Promise<{ documentId: string }> };

export default async function LongFormHistoryPage({ params }: Params) {
  const { documentId } = await params;
  return <LongFormView mode="history" documentId={documentId} />;
}
