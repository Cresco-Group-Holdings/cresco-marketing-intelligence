import type { ContentObjective } from "@/lib/content-intelligence/types";

export const CONTENT_OBJECTIVES: Array<{ value: ContentObjective; label: string }> = [
  { value: "awareness", label: "Awareness" },
  { value: "education", label: "Education" },
  { value: "engagement", label: "Engagement" },
  { value: "lead_generation", label: "Lead generation" },
  { value: "conversion", label: "Conversion" },
  { value: "retention", label: "Retention" },
  { value: "product_adoption", label: "Product adoption" },
  { value: "authority", label: "Authority / thought leadership" },
  { value: "community_growth", label: "Community growth" },
  { value: "traffic", label: "Traffic" },
  { value: "event_promotion", label: "Event promotion" },
];

export function resolveObjectiveLabel(value: string | null | undefined): string {
  if (!value) return "Not set";
  const match = CONTENT_OBJECTIVES.find((item) => item.value === value);
  return match?.label ?? value.replace(/_/g, " ");
}

export function mapStudioObjectiveToContentObjective(
  studioObjective: string | null | undefined,
): ContentObjective | null {
  if (!studioObjective) return null;
  const normalised = studioObjective.toLowerCase().replace(/\s+/g, "_");
  const match = CONTENT_OBJECTIVES.find((item) => item.value === normalised);
  return match?.value ?? null;
}
