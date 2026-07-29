import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withInboxRead } from "@/lib/api/inbox-handler";
import { inboxListFiltersSchema } from "@/lib/validation/inbox";
import { socialInboxQueryService } from "@/server/services/social-inbox-query-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const filters = inboxListFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams));

  return withInboxRead(request, organisationId, async ({ requestId, tenant }) => {
    const conversations = await socialInboxQueryService.listConversations(
      brandId,
      organisationId,
      {
        status: filters.status,
        conversationType: filters.conversationType,
        provider: filters.provider,
        socialAccountId: filters.socialAccountId,
        unread: filters.unreadOnly,
        search: filters.search,
        assigneeUserId: filters.assignedToUserId,
        tags: filters.tag ? [filters.tag] : undefined,
        priority: filters.priority,
        limit: filters.limit,
        cursor: filters.cursor,
      },
      tenant!,
    );
    return apiSuccess({ conversations }, { requestId });
  });
}
