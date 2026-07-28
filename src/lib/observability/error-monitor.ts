import { logger } from "@/lib/logging";
import { toSafeErrorMessage } from "@/lib/errors";

export type ErrorMonitorContext = {
  requestId?: string;
  organisationId?: string;
  userId?: string;
  component?: string;
  metadata?: Record<string, unknown>;
};

export interface ErrorMonitor {
  captureException(error: unknown, context?: ErrorMonitorContext): void;
  captureMessage(message: string, context?: ErrorMonitorContext): void;
}

class ConsoleErrorMonitor implements ErrorMonitor {
  captureException(error: unknown, context?: ErrorMonitorContext): void {
    logger.error("error.monitor.exception", {
      message: toSafeErrorMessage(error),
      ...(context ?? {}),
    });
  }

  captureMessage(message: string, context?: ErrorMonitorContext): void {
    logger.warn("error.monitor.message", {
      message,
      ...(context ?? {}),
    });
  }
}

let monitor: ErrorMonitor = new ConsoleErrorMonitor();

export function getErrorMonitor(): ErrorMonitor {
  return monitor;
}

export function setErrorMonitorForTests(instance: ErrorMonitor): void {
  monitor = instance;
}

export function resetErrorMonitorForTests(): void {
  monitor = new ConsoleErrorMonitor();
}
