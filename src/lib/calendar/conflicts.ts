import type { CalendarEvent } from "@prisma/client";

export type CalendarConflict = {
  eventId: string;
  conflictingEventId: string;
  brandId: string;
  channelType: string | null;
  startsAt: string;
  endsAt: string | null;
  title: string;
  conflictingTitle: string;
};

function eventEnd(event: Pick<CalendarEvent, "startsAt" | "endsAt">): Date {
  return event.endsAt ?? new Date(event.startsAt.getTime() + 30 * 60_000);
}

function overlaps(
  a: Pick<CalendarEvent, "startsAt" | "endsAt">,
  b: Pick<CalendarEvent, "startsAt" | "endsAt">,
): boolean {
  const aStart = a.startsAt.getTime();
  const aEnd = eventEnd(a).getTime();
  const bStart = b.startsAt.getTime();
  const bEnd = eventEnd(b).getTime();
  return aStart < bEnd && bStart < aEnd;
}

export function detectOverlappingEvents(
  events: CalendarEvent[],
  options?: { channelType?: string | null },
): CalendarConflict[] {
  const active = events.filter((event) => event.status !== "CANCELLED");
  const conflicts: CalendarConflict[] = [];

  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const left = active[i];
      const right = active[j];
      if (left.brandId !== right.brandId) continue;

      const channelFilter = options?.channelType;
      if (channelFilter) {
        const leftMatches = left.channelType === channelFilter || left.channelType == null;
        const rightMatches = right.channelType === channelFilter || right.channelType == null;
        if (!leftMatches || !rightMatches) continue;
        if (left.channelType && right.channelType && left.channelType !== right.channelType) {
          continue;
        }
      }

      if (!overlaps(left, right)) continue;

      conflicts.push({
        eventId: left.id,
        conflictingEventId: right.id,
        brandId: left.brandId,
        channelType: left.channelType ?? right.channelType,
        startsAt: left.startsAt.toISOString(),
        endsAt: left.endsAt?.toISOString() ?? null,
        title: left.title,
        conflictingTitle: right.title,
      });
    }
  }

  return conflicts;
}
