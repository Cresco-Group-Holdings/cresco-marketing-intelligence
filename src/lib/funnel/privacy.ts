import type { AnonymisedJourneySample } from "@/lib/funnel/types";

const FORBIDDEN_SAMPLE_FIELDS = ["email", "phone", "name", "displayName", "identityValue"];

export function sanitiseJourneySamples(
  samples: AnonymisedJourneySample[],
): AnonymisedJourneySample[] {
  return samples.map((sample) => {
    const sanitised: AnonymisedJourneySample = {
      anonymisedId: sample.anonymisedId,
      stepsReached: sample.stepsReached,
      completed: sample.completed,
      stepTimestamps: sample.stepTimestamps,
    };

    if (sample.segmentHints) {
      const hints: Record<string, string> = {};
      for (const [key, value] of Object.entries(sample.segmentHints)) {
        if (FORBIDDEN_SAMPLE_FIELDS.includes(key.toLowerCase())) continue;
        if (value.includes("@")) continue;
        hints[key] = value;
      }
      if (Object.keys(hints).length > 0) sanitised.segmentHints = hints;
    }

    return sanitised;
  });
}

export function canViewJourneySamples(hasPermission: boolean): boolean {
  return hasPermission;
}
