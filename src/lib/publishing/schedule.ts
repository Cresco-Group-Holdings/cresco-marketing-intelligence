import type { PublishingJob } from "@prisma/client";
import { AppError } from "@/lib/errors";

export type PublishingJobWithSchedule<TSchedule> = PublishingJob & {
  schedule: TSchedule;
};

/**
 * Legacy schedule-backed publishing jobs must include a content schedule.
 * Publication-backed jobs route through publication-publishing-worker instead.
 */
export function requirePublishingSchedule<T extends { schedule: TSchedule | null }, TSchedule>(
  job: T,
): PublishingJobWithSchedule<TSchedule> & T {
  if (!job.schedule) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Publishing job requires a content schedule for legacy provider execution.",
    );
  }

  return job as PublishingJobWithSchedule<TSchedule> & T;
}

export function hasPublishingSchedule<T extends { schedule: unknown | null }>(
  job: T,
): job is T & { schedule: NonNullable<T["schedule"]> } {
  return job.schedule != null;
}

/**
 * Normalizes nullable persistence values to optional domain fields.
 */
export function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}

export function resolveContentScheduleId(job: {
  contentScheduleId: string | null;
  schedule?: { id: string } | null;
}): string | undefined {
  return job.schedule?.id ?? nullToUndefined(job.contentScheduleId);
}
