type LogLevel = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEY_PATTERN =
  /(password|token|secret|api[_-]?key|authorization|cookie|refresh|access|prompt)/i;

function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return "[REDACTED]";
  }

  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : redactValue(nestedValue);
    }
    return result;
  }

  return value;
}

function writeLog(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context: redactValue(context) as Record<string, unknown> } : {}),
  };

  const serialized = JSON.stringify(payload);

  switch (level) {
    case "error":
      console.error(serialized);
      break;
    case "warn":
      console.warn(serialized);
      break;
    default:
      console.log(serialized);
  }
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>) {
    writeLog("debug", message, context);
  },
  info(message: string, context?: Record<string, unknown>) {
    writeLog("info", message, context);
  },
  warn(message: string, context?: Record<string, unknown>) {
    writeLog("warn", message, context);
  },
  error(message: string, context?: Record<string, unknown>) {
    writeLog("error", message, context);
  },
};
