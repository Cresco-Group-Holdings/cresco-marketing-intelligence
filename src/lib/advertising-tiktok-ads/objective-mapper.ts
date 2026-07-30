import { TIKTOK_OBJECTIVE_TRANSLATION, SUPPORTED_TIKTOK_OBJECTIVES } from "./constants";
import { isCapabilityAvailable, TIKTOK_ADS_CAPABILITIES } from "@/lib/advertising-providers/capability-gates";

export function translatePlanObjective(primaryObjective?: string | null) {
  const key = primaryObjective ?? "WEBSITE_TRAFFIC";
  const mapping = TIKTOK_OBJECTIVE_TRANSLATION[key];
  if (!mapping) {
    return { tiktokObjective: "TRAFFIC", label: "Traffic", supported: false };
  }
  const capId =
    mapping.tiktok === "LEAD_GENERATION" ? "lead_generation"
    : mapping.tiktok === "VIDEO_VIEWS" ? "video_views"
    : mapping.tiktok === "WEB_CONVERSIONS" ? "website_conversion"
    : "traffic";
  const supported = isCapabilityAvailable(TIKTOK_ADS_CAPABILITIES, capId);
  return { tiktokObjective: mapping.tiktok, label: mapping.label, supported };
}

export function isSupportedObjective(objective: string): boolean {
  return (SUPPORTED_TIKTOK_OBJECTIVES as readonly string[]).includes(objective);
}
