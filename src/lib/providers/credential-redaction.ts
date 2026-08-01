const SENSITIVE_KEYS = new Set([
  "access_token",
  "refresh_token",
  "api_key",
  "apiKey",
  "client_secret",
  "clientSecret",
  "password",
  "secret",
  "token",
  "authorization",
  "private_key",
  "privateKey",
  "webhook_secret",
  "webhookSecret",
  "encryptedValue",
  "credentialsRef",
]);

const SECRET_PATTERN = /\b(sk|pk)_[A-Za-z0-9]{10,}\b|Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;

export function redactSecrets<T>(value: T): T {
  return redactValue(value) as T;
}

function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return value.replace(SECRET_PATTERN, "[REDACTED]");
  }

  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key)) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactValue(nested);
      }
    }
    return result;
  }

  return value;
}

export function fingerprintCredential(value: string): string {
  if (value.length <= 4) {
    return "****";
  }
  return `****${value.slice(-4)}`;
}

export function sanitizeErrorMessage(message: string): string {
  return message.replace(SECRET_PATTERN, "[REDACTED]");
}
