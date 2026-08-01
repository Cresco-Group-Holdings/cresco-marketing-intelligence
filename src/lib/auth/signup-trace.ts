type UrlRuntimeMetadata = {
  present: boolean;
  host?: string;
  port?: string;
  database?: string;
  parseOk: boolean;
};

function parseUrlRuntimeMetadata(value: string | undefined, options?: { database?: boolean }): UrlRuntimeMetadata {
  if (!value) {
    return { present: false, parseOk: false };
  }

  try {
    const parsed = new URL(value);
    return {
      present: true,
      parseOk: true,
      host: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? "443" : parsed.protocol === "postgresql:" ? "5432" : "80"),
      database: options?.database ? parsed.pathname.replace(/^\//, "") || "(default)" : undefined,
    };
  } catch {
    return { present: true, parseOk: false };
  }
}

export function logSignupRuntimeEnv(requestId: string): void {
  logSignupTrace("RUNTIME_ENV", requestId, {
    NEXT_PUBLIC_SUPABASE_URL: parseUrlRuntimeMetadata(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_URL: parseUrlRuntimeMetadata(process.env.SUPABASE_URL),
    DATABASE_URL: parseUrlRuntimeMetadata(process.env.DATABASE_URL, { database: true }),
    DIRECT_URL: parseUrlRuntimeMetadata(process.env.DIRECT_URL, { database: true }),
    APP_URL: parseUrlRuntimeMetadata(process.env.APP_URL),
    supabaseAnonKeyPresent: Boolean(
      process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    supabaseAnonKeyLength: (process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      ?.length,
  });
}

export function logSignupTrace(step: string, requestId: string, details: Record<string, unknown> = {}): void {
  console.error(
    JSON.stringify({
      channel: "signup.trace",
      step,
      requestId,
      timestamp: new Date().toISOString(),
      ...details,
    }),
  );
}

function extractErrorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const details: Record<string, unknown> = {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    };

    if ("code" in error && error.code !== undefined) {
      details.errorCode = error.code;
    }

    if ("status" in error && error.status !== undefined) {
      details.errorStatus = error.status;
    }

    if ("cause" in error && error.cause !== undefined) {
      details.errorCause = extractErrorDetails(error.cause);
    }

    return details;
  }

  return {
    errorName: "NonErrorThrown",
    errorMessage: String(error),
  };
}

export function logSignupCatch(step: string, requestId: string, error: unknown): void {
  logSignupTrace(`CATCH ${step}`, requestId, extractErrorDetails(error));
}
