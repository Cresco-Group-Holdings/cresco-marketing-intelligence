import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";

/** Generation phases tracked on ContentProvenance.metadata without new tables. */
export type StudioGenerationPhase = "brief" | "master" | "variants";

export type StudioGenerationStatus = "in_progress" | "completed" | "failed";

export type StudioGenerationState = {
  phase: StudioGenerationPhase;
  idempotencyKey: string;
  status: StudioGenerationStatus;
  aiRequestId?: string;
  versionNumber?: number;
  structuredOutput?: Record<string, unknown>;
  failedAt?: string;
  errorMessage?: string;
  completedAt?: string;
};

export type ContentProvenanceMetadata = {
  studioGenerations?: Partial<Record<StudioGenerationPhase, StudioGenerationState>>;
};

export function buildStudioGenerationRequestId(input: {
  organisationId: string;
  brandId: string;
  contentItemId: string;
  phase: StudioGenerationPhase;
  idempotencyKey: string;
}): string {
  return `studio:${input.phase}:${input.organisationId}:${input.brandId}:${input.contentItemId}:${input.idempotencyKey}`;
}

export function parseProvenanceMetadata(metadata: Prisma.JsonValue | null): ContentProvenanceMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as ContentProvenanceMetadata;
}

export function getStudioGenerationState(
  metadata: Prisma.JsonValue | null,
  phase: StudioGenerationPhase,
): StudioGenerationState | null {
  const parsed = parseProvenanceMetadata(metadata);
  return parsed.studioGenerations?.[phase] ?? null;
}

export function mergeStudioGenerationState(
  metadata: Prisma.JsonValue | null,
  phase: StudioGenerationPhase,
  state: StudioGenerationState,
): ContentProvenanceMetadata {
  const parsed = parseProvenanceMetadata(metadata);
  return {
    ...parsed,
    studioGenerations: {
      ...parsed.studioGenerations,
      [phase]: state,
    },
  };
}

export async function findCompletedAiRequestByRequestId(
  organisationId: string,
  requestId: string,
) {
  return prisma.aIRequest.findFirst({
    where: {
      organisationId,
      requestId,
      status: "COMPLETED",
    },
    include: {
      executions: {
        where: { status: "COMPLETED" },
        orderBy: { attemptNumber: "desc" },
        take: 1,
      },
    },
  });
}

export async function assertStudioGenerationNotInProgress(
  organisationId: string,
  requestId: string,
): Promise<void> {
  const running = await prisma.aIRequest.findFirst({
    where: {
      organisationId,
      requestId,
      status: { in: ["PENDING", "RUNNING"] },
    },
  });
  if (running) {
    throw new AppError("CONFLICT", "A generation with this idempotency key is already in progress.");
  }
}
