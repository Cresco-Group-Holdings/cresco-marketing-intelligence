import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withProviderConnectionsWrite,
} from "@/lib/api/providers-handler";
import type { EmailSendRequest } from "@/lib/providers/email-types";
import { unifiedEmailProviderService } from "@/server/services/unified-email-provider-service";

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);

  return withProviderConnectionsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const body = (await request.json()) as EmailSendRequest & {
      testMode?: boolean;
    };

    const result = await unifiedEmailProviderService.sendEmail(
      { ...body, organisationId },
      {
        tenantContext: tenant!,
        connectionId: body.connectionId,
        messageType: body.messageType,
        approvalId: body.approvalId,
        testMode: body.testMode,
        requestId,
      },
    );

    return apiSuccess({ send: result }, { requestId });
  });
}
