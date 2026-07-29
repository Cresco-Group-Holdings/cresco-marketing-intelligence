import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withOperationsRecover,
} from "@/lib/api/notifications-handler";
import { recoveryActionSchema } from "@/lib/validation/notifications";
import { recoveryActionService } from "@/server/services/recovery-action-service";

type Params = { params: Promise<{ alertId: string }> };

const ACTIONS = ["retry", "resolve", "cancel", "reconnect", "manual-confirm"] as const;

export async function POST(request: NextRequest, { params }: Params) {
  const { alertId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = request.nextUrl.searchParams.get("action");
  if (!action || !ACTIONS.includes(action as (typeof ACTIONS)[number])) {
    throw new AppError("VALIDATION_ERROR", `Action must be one of: ${ACTIONS.join(", ")}.`);
  }

  const actionTypeMap = {
    retry: "RETRY",
    resolve: "RESOLVE",
    cancel: "CANCEL",
    reconnect: "RECONNECT",
    "manual-confirm": "MANUAL_CONFIRM",
  } as const;

  const raw = (await jsonBody(request).catch(() => ({}))) as {
    idempotencyKey?: string;
    resourceType?: string;
    resourceId?: string;
  };
  const body = parseBody(recoveryActionSchema, {
    actionType: actionTypeMap[action as keyof typeof actionTypeMap],
    idempotencyKey:
      typeof raw.idempotencyKey === "string"
        ? raw.idempotencyKey
        : `${action}:${alertId}:${Date.now()}`,
    resourceType: raw.resourceType,
    resourceId: raw.resourceId,
  });

  return withOperationsRecover(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await recoveryActionService.execute(organisationId, alertId, body, tenant!),
      { requestId },
    ),
  );
}
