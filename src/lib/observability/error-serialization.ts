import { AppError } from "@/lib/errors";

export type SerializedErrorForLog = {
  name: string;
  message: string;
  code?: string | number;
  status?: number;
  stack?: string;
  cause?: SerializedErrorForLog;
};

export function serializeErrorForServerLog(error: unknown): {
  error: SerializedErrorForLog;
} {
  return { error: serializeErrorNode(error) };
}

function serializeErrorNode(error: unknown): SerializedErrorForLog {
  if (error instanceof AppError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status,
      stack: error.stack,
      cause: error.cause !== undefined ? serializeErrorNode(error.cause) : undefined,
    };
  }

  if (error instanceof Error) {
    const serialized: SerializedErrorForLog = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    if ("code" in error && error.code !== undefined) {
      serialized.code = error.code as string | number;
    }

    if ("status" in error && error.status !== undefined) {
      serialized.status = error.status as number;
    }

    if ("cause" in error && error.cause !== undefined) {
      serialized.cause = serializeErrorNode(error.cause);
    }

    return serialized;
  }

  return {
    name: "NonErrorThrown",
    message: String(error),
  };
}
