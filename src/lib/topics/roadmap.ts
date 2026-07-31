import { ROADMAP_TRANSITIONS } from "@/lib/topics/constants";
import type { SeoRoadmapStatus } from "@prisma/client";

export function canTransitionRoadmap(from: SeoRoadmapStatus, to: SeoRoadmapStatus): boolean {
  const allowed = ROADMAP_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

export function assertRoadmapTransition(from: SeoRoadmapStatus, to: SeoRoadmapStatus): void {
  if (!canTransitionRoadmap(from, to)) {
    throw new Error(`Invalid roadmap transition from ${from} to ${to}`);
  }
}
