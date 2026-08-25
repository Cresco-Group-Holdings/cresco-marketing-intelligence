/**
 * Central scheduling configuration.
 *
 * Separates job implementation from deployment scheduling so Vercel Hobby
 * (≤1 invocation/day) can coexist with future Pro or external high-frequency schedulers.
 */

/** Target production cadence when high-frequency scheduling is available (Pro / external worker). */
export const PRODUCTION_TARGET_SCHEDULES = {
  /** Enqueue and drain due social publishing schedules. */
  publishing: "*/5 * * * *",
  /** Example future jobs — not yet wired to Vercel cron. */
  socialAnalytics: "*/15 * * * *",
  seoCrawl: "*/10 * * * *",
  digitalAssets: "*/15 * * * *",
} as const;

/**
 * Vercel Hobby deployment schedules — each expression MUST run at most once per day.
 * See https://vercel.com/docs/cron-jobs/usage-and-pricing
 */
export const VERCEL_HOBBY_CRON_SCHEDULES = {
  /** Single daily dispatcher that fans out to internal jobs in bounded batches. */
  dailyDispatch: "0 2 * * *",
} as const;

export const VERCEL_CRON_PATHS = {
  dailyDispatch: "/api/cron/daily-dispatch",
  /** Legacy direct entry — manual / external scheduler only on Hobby. */
  publishingScheduler: "/api/publishing-scheduler/process-due",
} as const;

export type InternalCronJobId =
  | "publishing"
  | "worker_dispatch"
  | "automation"
  | "intelligence";

export type InternalCronJobDefinition = {
  id: InternalCronJobId;
  description: string;
  /** Target cadence when high-frequency scheduling is enabled. */
  targetSchedule: string;
  maxPassesPerDailyDispatch: number;
};

export const INTERNAL_CRON_JOBS: Record<InternalCronJobId, InternalCronJobDefinition> = {
  publishing: {
    id: "publishing",
    description: "Enqueue due content schedules and drain publishing jobs",
    targetSchedule: PRODUCTION_TARGET_SCHEDULES.publishing,
    maxPassesPerDailyDispatch: 8,
  },
  worker_dispatch: {
    id: "worker_dispatch",
    description: "Dispatch and process canonical worker jobs (sync, analytics, tokens)",
    targetSchedule: PRODUCTION_TARGET_SCHEDULES.socialAnalytics,
    maxPassesPerDailyDispatch: 4,
  },
  automation: {
    id: "automation",
    description: "Evaluate schedule triggers and process automation executions",
    targetSchedule: "0 * * * *",
    maxPassesPerDailyDispatch: 2,
  },
  intelligence: {
    id: "intelligence",
    description: "Stale data detection and background intelligence evaluation",
    targetSchedule: "0 6 * * *",
    maxPassesPerDailyDispatch: 1,
  },
};

export type DailyDispatchLimits = {
  maxPassesPerJob: number;
  maxTotalPasses: number;
  maxDurationMs: number;
};

const number = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
};

/** Bounded workload limits for the daily dispatcher (single Vercel invocation). */
export function getDailyDispatchLimits(): DailyDispatchLimits {
  return {
    maxPassesPerJob: number(process.env.CRON_DAILY_MAX_PASSES_PER_JOB, 8, 1, 20),
    maxTotalPasses: number(process.env.CRON_DAILY_MAX_TOTAL_PASSES, 12, 1, 40),
    maxDurationMs: number(process.env.CRON_DAILY_MAX_DURATION_MS, 50_000, 5_000, 55_000),
  };
}

export type ScheduledExecutionGate = {
  allowed: boolean;
  reason?: "PREVIEW_DISABLED" | "DEVELOPMENT_DISABLED" | "CRON_DISABLED";
};

/**
 * Prevents preview/development deployments from running scheduled side effects unless
 * operators explicitly opt in (Vercel Cron normally targets production only).
 */
export function evaluateScheduledExecutionGate(): ScheduledExecutionGate {
  if ((process.env.CRON_SCHEDULER_ENABLED ?? "true").toLowerCase() === "false") {
    return { allowed: false, reason: "CRON_DISABLED" };
  }

  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "preview" && process.env.CRON_ALLOW_PREVIEW?.toLowerCase() !== "true") {
    return { allowed: false, reason: "PREVIEW_DISABLED" };
  }

  if (
    (vercelEnv === "development" || process.env.NODE_ENV === "development") &&
    process.env.CRON_ALLOW_DEVELOPMENT?.toLowerCase() !== "true"
  ) {
    return { allowed: false, reason: "DEVELOPMENT_DISABLED" };
  }

  return { allowed: true };
}

/** Parse a 5-field cron minute field — returns null when not a simple daily schedule. */
function parseCronFields(expression: string): string[] | null {
  const trimmed = expression.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) return null;
  return parts;
}

/**
 * Returns true when a cron expression fires at most once per calendar day.
 * Accepts standard daily patterns like `0 2 * * *` and weekly `0 0 * * 0`.
 */
export function isHobbyCompatibleCronSchedule(expression: string): boolean {
  const parts = parseCronFields(expression);
  if (!parts) return false;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  if ([minute, hour, dayOfMonth, month, dayOfWeek].some((field) => field.includes("*/"))) {
    return false;
  }

  if (minute === "*" || hour === "*") {
    return false;
  }

  // Minute and hour must be fixed values or lists (not wildcards spanning the day).
  if (!/^\d+$/.test(minute) && !/^\d+(,\d+)*$/.test(minute)) {
    return false;
  }
  if (!/^\d+$/.test(hour) && !/^\d+(,\d+)*$/.test(hour)) {
    return false;
  }

  return true;
}

export function assertHobbyCompatibleCronSchedule(expression: string, label: string): void {
  if (!isHobbyCompatibleCronSchedule(expression)) {
    throw new Error(
      `${label} schedule "${expression}" is incompatible with Vercel Hobby (max once per day).`,
    );
  }
}
