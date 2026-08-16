export type Clock = {
  now: () => Date;
  random: () => number;
};

let injectedClock: Clock | null = null;

export function getClock(): Clock {
  if (injectedClock) return injectedClock;
  return {
    now: () => new Date(),
    random: () => Math.random(),
  };
}

/** Test-only: inject deterministic clock and randomness. */
export function setClockForTests(clock: Clock | null): void {
  injectedClock = clock;
}
