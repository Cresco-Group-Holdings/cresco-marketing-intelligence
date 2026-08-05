import { createHash } from "node:crypto";
import type { AgentPlatformStepType } from "@prisma/client";

export type TraceStepInput = {
  stepIndex: number;
  stepType: AgentPlatformStepType;
  title: string;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  latencyMs?: number;
  errorMessage?: string;
};

export function digestTracePayload(payload: unknown): string | undefined {
  if (payload === undefined || payload === null) return undefined;
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function buildTraceSteps(steps: TraceStepInput[]) {
  return steps.map((step) => ({
    stepIndex: step.stepIndex,
    stepType: step.stepType,
    title: step.title,
    inputDigest: digestTracePayload(step.input),
    outputDigest: digestTracePayload(step.output),
    metadata: step.metadata,
    latencyMs: step.latencyMs,
    errorMessage: step.errorMessage,
  }));
}
