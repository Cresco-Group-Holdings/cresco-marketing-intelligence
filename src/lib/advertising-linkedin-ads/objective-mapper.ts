import { LINKEDIN_OBJECTIVE_TRANSLATION, SUPPORTED_LINKEDIN_OBJECTIVES } from "./constants";
import { isCapabilityAvailable, LINKEDIN_ADS_CAPABILITIES } from "@/lib/advertising-providers/capability-gates";

export function translatePlanObjective(primaryObjective?: string | null) {
  const key = primaryObjective ?? "WEBSITE_TRAFFIC";
  const mapping = LINKEDIN_OBJECTIVE_TRANSLATION[key];
  if (!mapping) {
    return { linkedInObjective: "WEBSITE_VISITS", label: "Website visits", supported: false };
  }
  const capId =
    mapping.linkedIn === "LEAD_GENERATION" ? "lead_generation"
    : mapping.linkedIn === "ENGAGEMENT" ? "engagement"
    : "website_visits";
  const supported = isCapabilityAvailable(LINKEDIN_ADS_CAPABILITIES, capId);
  return {
    linkedInObjective: mapping.linkedIn,
    label: mapping.label,
    supported,
  };
}

export function isSupportedObjective(objective: string): boolean {
  return (SUPPORTED_LINKEDIN_OBJECTIVES as readonly string[]).includes(objective);
}
