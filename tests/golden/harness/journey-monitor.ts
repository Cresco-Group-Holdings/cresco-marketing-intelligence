export type JourneyMetrics = {
  durationMs: number;
  apiRequests: number;
  unexpected4xx: number;
  unexpected5xx: number;
  clientExceptions: number;
  retries: number;
};

export type JourneyRunResult = {
  journey: string;
  passed: boolean;
  metrics: JourneyMetrics;
  issues: string[];
};

const metrics: JourneyMetrics = {
  durationMs: 0,
  apiRequests: 0,
  unexpected4xx: 0,
  unexpected5xx: 0,
  clientExceptions: 0,
  retries: 0,
};

let startedAt = Date.now();

export function resetJourneyMonitor(): void {
  startedAt = Date.now();
  metrics.durationMs = 0;
  metrics.apiRequests = 0;
  metrics.unexpected4xx = 0;
  metrics.unexpected5xx = 0;
  metrics.clientExceptions = 0;
  metrics.retries = 0;
}

export function recordApiResponse(status: number, allowListed = false): void {
  metrics.apiRequests += 1;
  if (allowListed) return;
  if (status >= 500) metrics.unexpected5xx += 1;
  if (status >= 400 && status < 500) metrics.unexpected4xx += 1;
}

export function recordRetry(): void {
  metrics.retries += 1;
}

export function finishJourneyMonitor(): JourneyMetrics {
  metrics.durationMs = Date.now() - startedAt;
  return { ...metrics };
}
