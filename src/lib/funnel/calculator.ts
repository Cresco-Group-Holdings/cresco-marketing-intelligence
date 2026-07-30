import { MAX_JOURNEY_SAMPLES } from "@/lib/funnel/constants";
import type {
  AnonymisedJourneySample,
  FunnelAnalysisInput,
  FunnelAnalysisOutput,
  FunnelStepMetrics,
  FunnelSubjectEvent,
} from "@/lib/funnel/types";
import { anonymiseSubjectId, buildSubjectKey, matchesStep } from "@/lib/funnel/step-matcher";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

type SubjectProgress = {
  subjectKey: string;
  events: FunnelSubjectEvent[];
  stepsCompleted: number[];
  stepTimestamps: Date[];
};

function groupEventsBySubject(
  events: FunnelSubjectEvent[],
  countingMethod: FunnelAnalysisInput["countingMethod"],
): Map<string, FunnelSubjectEvent[]> {
  const grouped = new Map<string, FunnelSubjectEvent[]>();
  for (const event of events) {
    const key = buildSubjectKey(event, countingMethod);
    const list = grouped.get(key) ?? [];
    list.push(event);
    grouped.set(key, list);
  }
  for (const [, list] of grouped) {
    list.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  }
  return grouped;
}

function evaluateSubject(
  subjectEvents: FunnelSubjectEvent[],
  steps: FunnelAnalysisInput["steps"],
): SubjectProgress {
  const subjectKey = subjectEvents[0]?.subjectKey ?? "unknown";
  const stepsCompleted: number[] = [];
  const stepTimestamps: Date[] = [];
  let nextRequiredStep = 0;

  for (const event of subjectEvents) {
    while (nextRequiredStep < steps.length) {
      const step = steps[nextRequiredStep]!;
      if (!matchesStep(event, step)) {
        if (step.requirement === "OPTIONAL") {
          nextRequiredStep += 1;
          continue;
        }
        break;
      }

      if (stepsCompleted.length > 0) {
        const prevStep = steps[stepsCompleted[stepsCompleted.length - 1]!]!;
        const prevTimestamp = stepTimestamps[stepTimestamps.length - 1]!;
        const maxTime = prevStep.maxTimeToNextStepMs;
        if (maxTime && event.occurredAt.getTime() - prevTimestamp.getTime() > maxTime) {
          break;
        }
      }

      stepsCompleted.push(step.stepOrder);
      stepTimestamps.push(event.occurredAt);
      nextRequiredStep += 1;

      if (step.requirement === "OPTIONAL") continue;
      break;
    }
  }

  return { subjectKey, events: subjectEvents, stepsCompleted, stepTimestamps };
}

export function calculateFunnel(input: FunnelAnalysisInput): FunnelAnalysisOutput {
  const sortedSteps = [...input.steps].sort((a, b) => a.stepOrder - b.stepOrder);
  const grouped = groupEventsBySubject(input.events, input.countingMethod);
  const progresses = [...grouped.values()].map((events) => evaluateSubject(events, sortedSteps));

  const firstStep = sortedSteps[0];
  const entrants = firstStep
    ? progresses.filter((p) => p.stepsCompleted.includes(firstStep.stepOrder)).length
    : 0;

  const lastStep = sortedSteps[sortedSteps.length - 1];
  const totalConversions = lastStep
    ? progresses.filter((p) => p.stepsCompleted.includes(lastStep.stepOrder)).length
    : 0;

  const stepResults: FunnelStepMetrics[] = sortedSteps.map((step, index) => {
    const completedSubjects = progresses.filter((p) => p.stepsCompleted.includes(step.stepOrder));
    const completions = completedSubjects.length;

    const prevStep = index > 0 ? sortedSteps[index - 1] : null;
    const prevCompletions = prevStep
      ? progresses.filter((p) => p.stepsCompleted.includes(prevStep.stepOrder)).length
      : entrants;

    const stepEntrants = index === 0 ? entrants : prevCompletions;
    const dropOffCount = Math.max(0, stepEntrants - completions);
    const stepConversion = stepEntrants > 0 ? (completions / stepEntrants) * 100 : 0;
    const cumulativeConversion = entrants > 0 ? (completions / entrants) * 100 : 0;
    const dropOffRate = stepEntrants > 0 ? (dropOffCount / stepEntrants) * 100 : 0;

    const transitionTimes: number[] = [];
    if (prevStep) {
      for (const progress of completedSubjects) {
        const prevIdx = progress.stepsCompleted.indexOf(prevStep.stepOrder);
        const currIdx = progress.stepsCompleted.indexOf(step.stepOrder);
        if (prevIdx >= 0 && currIdx >= 0) {
          const delta =
            progress.stepTimestamps[currIdx]!.getTime() - progress.stepTimestamps[prevIdx]!.getTime();
          if (delta >= 0) transitionTimes.push(delta);
        }
      }
    }

    return {
      stepId: step.id,
      stepOrder: step.stepOrder,
      stepName: step.name,
      entrants: stepEntrants,
      completions,
      stepConversion: Math.round(stepConversion * 10000) / 10000,
      cumulativeConversion: Math.round(cumulativeConversion * 10000) / 10000,
      dropOffCount,
      dropOffRate: Math.round(dropOffRate * 10000) / 10000,
      medianTimeToNextMs: median(transitionTimes),
    };
  });

  const warnings: string[] = [];
  if (input.events.length === 0) warnings.push("No events found in the selected date range.");
  if (entrants === 0) warnings.push("No subjects entered the first funnel step.");

  const journeySamples: AnonymisedJourneySample[] = progresses
    .slice(0, MAX_JOURNEY_SAMPLES)
    .map((progress) => ({
      anonymisedId: anonymiseSubjectId(progress.subjectKey),
      stepsReached: progress.stepsCompleted.length,
      completed: lastStep ? progress.stepsCompleted.includes(lastStep.stepOrder) : false,
      stepTimestamps: progress.stepTimestamps.map((d) => d.toISOString()),
    }));

  return {
    entrants,
    totalConversions,
    stepResults,
    journeySamples,
    dataQualityWarnings: warnings,
  };
}
