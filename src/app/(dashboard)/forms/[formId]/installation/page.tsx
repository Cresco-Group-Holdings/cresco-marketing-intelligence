import { FormsView } from "@/components/forms/forms-view";

type Props = { params: Promise<{ formId: string }> };

export default async function FormInstallationPage({ params }: Props) {
  const { formId } = await params;
  return <FormsView mode="installation" formId={formId} />;
}
