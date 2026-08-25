import { notFound } from "next/navigation";
import { DashboardPreviewShell } from "@/components/layout/dashboard-preview-shell";
import { OnboardingVisualPreview } from "@/components/activation/onboarding-visual-preview";
import {
  ONBOARDING_VISUAL_PREVIEW_SCENES,
  type OnboardingVisualPreviewScene,
} from "@/lib/activation/visual-preview-fixture";

type PageProps = {
  params: Promise<{ scene: string }>;
};

export default async function OnboardingVisualPreviewPage({ params }: PageProps) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { scene } = await params;
  if (!Object.values(ONBOARDING_VISUAL_PREVIEW_SCENES).includes(scene as OnboardingVisualPreviewScene)) {
    notFound();
  }

  return (
    <DashboardPreviewShell>
      <OnboardingVisualPreview scene={scene as OnboardingVisualPreviewScene} />
    </DashboardPreviewShell>
  );
}
