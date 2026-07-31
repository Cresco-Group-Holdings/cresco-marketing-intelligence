export function validateSchedule(input: {
  startAt?: Date | null;
  endAt?: Date | null;
  timezone?: string;
  launchWindowStart?: Date | null;
  launchWindowEnd?: Date | null;
}): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (input.startAt && input.endAt && input.endAt <= input.startAt) {
    errors.push("End date must be after start date.");
  }
  if (input.endAt && input.endAt < new Date()) {
    errors.push("Campaign end date has expired.");
  }
  if (input.launchWindowStart && input.launchWindowEnd && input.launchWindowEnd <= input.launchWindowStart) {
    errors.push("Launch window end must be after start.");
  }
  if (input.timezone && input.timezone !== "UTC") {
    warnings.push("Provider timezone may differ from plan timezone.");
  }

  return { errors, warnings };
}
