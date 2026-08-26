import type { FunnelStage } from "@/lib/content-intelligence/types";

export const FUNNEL_STAGES: Array<{ value: FunnelStage; label: string }> = [
  { value: "awareness", label: "Awareness" },
  { value: "consideration", label: "Consideration" },
  { value: "evaluation", label: "Evaluation" },
  { value: "conversion", label: "Conversion" },
  { value: "retention", label: "Retention" },
  { value: "advocacy", label: "Advocacy" },
];

export function resolveFunnelStageLabel(value: string | null | undefined): string {
  if (!value) return "Not set";
  const match = FUNNEL_STAGES.find((item) => item.value === value);
  return match?.label ?? value.replace(/_/g, " ");
}
