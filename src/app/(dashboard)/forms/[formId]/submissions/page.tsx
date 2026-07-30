import { FormsView } from "@/components/forms/forms-view";

type Props = { params: Promise<{ formId: string }> };

export default async function FormSubmissionsPage({ params }: Props) {
  const { formId } = await params;
  return <FormsView mode="submissions" formId={formId} />;
}
