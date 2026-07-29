import type { SocialProvider } from "@prisma/client";

const PROVIDERS: SocialProvider[] = [
  "INSTAGRAM",
  "FACEBOOK",
  "LINKEDIN",
  "TIKTOK",
  "YOUTUBE",
  "X",
];

const number = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
};

export type PublishingConfig = {
  schedulerEnabled: boolean;
  emergencyShutdown: boolean;
  maxSchedulesPerRun: number;
  maxJobsPerWorkerRun: number;
  retryBackoffSeconds: number;
  disabledProviders: ReadonlySet<SocialProvider>;
};

function readDisabledProviders(): Set<SocialProvider> {
  const disabled = new Set<SocialProvider>();
  for (const provider of PROVIDERS) {
    const flag = process.env[`PUBLISHING_DISABLE_${provider}`];
    if (flag?.toLowerCase() === "true") {
      disabled.add(provider);
    }
  }
  return disabled;
}

/**
 * Read at call time so operators can flip emergency shutdown flags without redeploying and so
 * tests can exercise different provider combinations.
 */
export function getPublishingConfig(): PublishingConfig {
  const emergencyShutdown =
    (process.env.PUBLISHING_EMERGENCY_SHUTDOWN ?? "false").toLowerCase() === "true";
  return {
    schedulerEnabled:
      !emergencyShutdown &&
      (process.env.PUBLISHING_SCHEDULER_ENABLED ?? "true").toLowerCase() !== "false",
    emergencyShutdown,
    maxSchedulesPerRun: number(process.env.PUBLISHING_SCHEDULER_BATCH, 50, 1, 500),
    maxJobsPerWorkerRun: number(process.env.PUBLISHING_WORKER_BATCH, 10, 1, 50),
    retryBackoffSeconds: number(process.env.PUBLISHING_RETRY_SECONDS, 60, 5, 3_600),
    disabledProviders: readDisabledProviders(),
  };
}

/** Emergency per-provider kill switch for incident response. */
export function isProviderPublishingDisabled(provider: SocialProvider): boolean {
  const config = getPublishingConfig();
  return config.emergencyShutdown || config.disabledProviders.has(provider);
}

export function scheduledJobIdempotencyKey(contentScheduleId: string): string {
  return `schedule:${contentScheduleId}`;
}
