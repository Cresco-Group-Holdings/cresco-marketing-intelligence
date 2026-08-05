export type DateRangeInput = {
  from: Date | string;
  to: Date | string;
  timezone?: string;
};

export function parseDateBoundary(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date boundary.");
  }
  return date;
}

export function normaliseDateRange(input: DateRangeInput): { from: Date; to: Date } {
  const from = parseDateBoundary(input.from);
  const to = parseDateBoundary(input.to);

  if (from.getTime() > to.getTime()) {
    throw new Error("Date range 'from' must be before or equal to 'to'.");
  }

  return { from, to };
}

export function isWithinRange(occurredAt: Date, range: { from: Date; to: Date }): boolean {
  const timestamp = occurredAt.getTime();
  return timestamp >= range.from.getTime() && timestamp <= range.to.getTime();
}

export function inclusiveDayBoundaries(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}
