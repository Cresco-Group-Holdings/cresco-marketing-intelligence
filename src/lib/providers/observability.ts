type ProviderMetricCounters = {
  sendAttempts: number;
  acceptedSends: number;
  rejectedSends: number;
  webhookVerificationFailures: number;
  rateLimitEvents: number;
  providerErrors: number;
};

const counters: ProviderMetricCounters = {
  sendAttempts: 0,
  acceptedSends: 0,
  rejectedSends: 0,
  webhookVerificationFailures: 0,
  rateLimitEvents: 0,
  providerErrors: 0,
};

export const providerMetrics = {
  increment(metric: keyof ProviderMetricCounters, amount = 1) {
    counters[metric] += amount;
  },

  snapshot(): ProviderMetricCounters {
    return { ...counters };
  },

  resetForTests() {
    counters.sendAttempts = 0;
    counters.acceptedSends = 0;
    counters.rejectedSends = 0;
    counters.webhookVerificationFailures = 0;
    counters.rateLimitEvents = 0;
    counters.providerErrors = 0;
  },

  logStructured(event: string, metadata: Record<string, unknown>) {
    const safe = { ...metadata };
    delete safe.apiKey;
    delete safe.webhookSecret;
    delete safe.html;
    delete safe.text;
    delete safe.body;
    console.info(JSON.stringify({ level: "info", event, ...safe, timestamp: new Date().toISOString() }));
  },
};
