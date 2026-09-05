type InFlightRequest<T> = Promise<T>;

const inFlightRequests = new Map<string, InFlightRequest<unknown>>();

export function dedupeRequest<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const request = factory().finally(() => {
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, request);
  return request;
}

export function clearDedupedRequests(): void {
  inFlightRequests.clear();
}
