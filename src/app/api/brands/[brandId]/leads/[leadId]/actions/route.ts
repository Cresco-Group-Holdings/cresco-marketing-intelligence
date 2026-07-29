import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withLeadsAssign,
  withLeadsQualify,
  withLeadsRead,
  withLeadsWrite,
} from "@/lib/api/leads-handler";
import { AppError } from "@/lib/errors";
import {
  leadAssignSchema,
  leadConsentSchema,
  leadCrmHandoffSchema,
  leadNoteSchema,
  leadQualificationSchema,
  leadAiQualificationSchema,
  leadUpdateSchema,
} from "@/lib/validation/leads";
import { leadCrmHandoffService } from "@/server/services/lead-crm-handoff-service";
import { leadPrivacyService } from "@/server/services/lead-privacy-service";
import { leadQualificationService } from "@/server/services/lead-qualification-service";
import { leadQualificationSuggestionService } from "@/server/services/lead-qualification-suggestion-service";
import { marketingLeadService } from "@/server/services/marketing-lead-service";

type Params = { params: Promise<{ brandId: string; leadId: string }> };

const ACTIONS = [
  "update",
  "assign",
  "qualify",
  "suggest-qualification",
  "consent",
  "note",
  "crm-handoff",
  "export-record",
] as const;

type LeadAction = (typeof ACTIONS)[number];

function parseAction(request: NextRequest): LeadAction {
  const action = request.nextUrl.searchParams.get("action");
  if (!action || !ACTIONS.includes(action as LeadAction)) {
    throw new AppError("VALIDATION_ERROR", `Action must be one of: ${ACTIONS.join(", ")}.`);
  }
  return action as LeadAction;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, leadId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = parseAction(request);
  const rawBody = await jsonBody(request);

  switch (action) {
    case "update": {
      const body = parseBody(leadUpdateSchema, rawBody);
      return withLeadsWrite(request, organisationId, async ({ requestId, tenant }) =>
        apiSuccess(
          {
            lead: await marketingLeadService.update(
              brandId,
              organisationId,
              leadId,
              body,
              tenant!,
            ),
          },
          { requestId },
        ),
      );
    }
    case "assign": {
      const body = parseBody(leadAssignSchema, rawBody);
      return withLeadsAssign(request, organisationId, async ({ requestId, tenant }) =>
        apiSuccess(
          await marketingLeadService.assign(brandId, organisationId, leadId, body, tenant!),
          { requestId },
        ),
      );
    }
    case "qualify": {
      const body = parseBody(leadQualificationSchema, rawBody);
      return withLeadsQualify(request, organisationId, async ({ requestId, tenant }) =>
        apiSuccess(
          {
            qualification: await leadQualificationService.upsert(
              brandId,
              organisationId,
              leadId,
              {
                ...body,
                answers: body.answers as Record<string, string | boolean | null>,
              },
              tenant!,
            ),
          },
          { requestId },
        ),
      );
    }
    case "suggest-qualification": {
      const body = parseBody(leadAiQualificationSchema, rawBody);
      return withLeadsQualify(request, organisationId, async ({ requestId, tenant }) =>
        apiSuccess(
          await leadQualificationSuggestionService.suggest(
            brandId,
            organisationId,
            leadId,
            body,
            tenant!,
          ),
          { requestId },
        ),
      );
    }
    case "consent": {
      const body = parseBody(leadConsentSchema, rawBody);
      return withLeadsWrite(request, organisationId, async ({ requestId, tenant }) =>
        apiSuccess(
          {
            consent: await leadPrivacyService.updateConsent(
              brandId,
              organisationId,
              leadId,
              body,
              tenant!,
            ),
          },
          { requestId },
        ),
      );
    }
    case "note": {
      const body = parseBody(leadNoteSchema, rawBody);
      return withLeadsWrite(request, organisationId, async ({ requestId, tenant }) =>
        apiSuccess(
          {
            activity: await marketingLeadService.addNote(
              brandId,
              organisationId,
              leadId,
              body.note,
              tenant!,
            ),
          },
          { requestId },
        ),
      );
    }
    case "crm-handoff": {
      const body = parseBody(leadCrmHandoffSchema, rawBody);
      return withLeadsWrite(request, organisationId, async ({ requestId, tenant }) =>
        apiSuccess(
          await leadCrmHandoffService.handoff(brandId, organisationId, leadId, body, tenant!),
          { requestId },
        ),
      );
    }
    case "export-record": {
      return withLeadsRead(request, organisationId, async ({ requestId, tenant }) =>
        apiSuccess(
          await leadPrivacyService.exportIndividualRecord(
            brandId,
            organisationId,
            leadId,
            tenant!,
          ),
          { requestId },
        ),
      );
    }
    default:
      throw new AppError("VALIDATION_ERROR", "Unsupported lead action.");
  }
}
