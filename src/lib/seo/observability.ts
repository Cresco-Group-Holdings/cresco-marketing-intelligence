const counters = new Map<string, number>();

export function incrementSeoCounter(name: string, delta = 1) {
  counters.set(name, (counters.get(name) ?? 0) + delta);
}

export function getSeoCounters(): Record<string, number> {
  return Object.fromEntries(counters);
}

export function resetSeoCounters() {
  counters.clear();
}
