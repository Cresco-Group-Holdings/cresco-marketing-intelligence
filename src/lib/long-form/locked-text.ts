export type LockedRange = { start: number; end: number };

export function mergeSectionWithLockedText(
  originalBody: string,
  newBody: string,
  lockedRanges: LockedRange[] | null | undefined,
): string {
  if (!lockedRanges?.length) return newBody;

  const sorted = [...lockedRanges].sort((a, b) => a.start - b.start);
  let result = "";
  let newCursor = 0;

  for (const range of sorted) {
    const lockedText = originalBody.slice(range.start, range.end);
    const beforeLocked = originalBody.slice(
      sorted.indexOf(range) === 0 ? 0 : (sorted[sorted.indexOf(range) - 1]?.end ?? 0),
      range.start,
    );

    if (beforeLocked.trim()) {
      const idx = newBody.indexOf(beforeLocked.slice(0, Math.min(20, beforeLocked.length)), newCursor);
      if (idx >= 0) {
        result += newBody.slice(newCursor, idx + beforeLocked.length);
        newCursor = idx + beforeLocked.length;
      }
    }

    result += lockedText;
  }

  if (newCursor < newBody.length) {
    result += newBody.slice(newCursor);
  }

  return result || newBody;
}

export function extractLockedRanges(body: string, lockedPhrases: string[]): LockedRange[] {
  const ranges: LockedRange[] = [];
  for (const phrase of lockedPhrases) {
    const idx = body.indexOf(phrase);
    if (idx >= 0) {
      ranges.push({ start: idx, end: idx + phrase.length });
    }
  }
  return ranges;
}
