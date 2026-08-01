import { logger } from "@/lib/logging";
import { serializeErrorForServerLog } from "@/lib/observability/error-serialization";

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
    const { error: serializedError } = serializeErrorForServerLog(error);

    console.error(
      JSON.stringify({
        channel: "error.monitor.exception",
        level: "error",
        message: "error.monitor.exception",
        timestamp: new Date().toISOString(),
        requestId: context?.requestId,
        organisationId: context?.organisationId,
        userId: context?.userId,
        component: context?.component,
        metadata: context?.metadata,
        error: serializedError,
        cause: serializedError.cause,
      }),
    );
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
