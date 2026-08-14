import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withNotificationsRead,
  withNotificationsWrite,
} from "@/lib/api/notifications-handler";
import { unifiedInboxService } from "@/server/services/unified-inbox-service";
import type { InboxSection } from "@prisma/client";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const section = (request.nextUrl.searchParams.get("section") ?? "ALL") as InboxSection;
  const unreadOnly = request.nextUrl.searchParams.get("unreadOnly") === "true";
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "25");

  return withNotificationsRead(request, organisationId, async ({ requestId, tenant }) => {
    const unread = await unifiedInboxService.unreadCount(
      organisationId,
      tenant!.userProfileId,
      tenant!,
    );
    const result = await unifiedInboxService.list(
      organisationId,
      tenant!.userProfileId,
      tenant!,
      { section, unreadOnly, cursor, limit },
    );
    return apiSuccess({ unread, ...result }, { requestId });
  });
}

export async function PATCH(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "markAllRead") {
    return withNotificationsWrite(request, organisationId, async ({ requestId, tenant }) => {
      const result = await unifiedInboxService.markAllRead(
        organisationId,
        tenant!.userProfileId,
        tenant!,
      );
      return apiSuccess(result, { requestId });
    });
  }

  if (body.action === "bulk" && Array.isArray(body.itemIds)) {
    return withNotificationsWrite(request, organisationId, async ({ requestId, tenant }) => {
      const result = await unifiedInboxService.bulkAction(
        organisationId,
        tenant!.userProfileId,
        body.itemIds,
        body.bulkAction ?? "read",
        tenant!,
      );
      return apiSuccess(result, { requestId });
    });
  }

  const itemId = body.itemId ?? request.nextUrl.searchParams.get("itemId");
  if (!itemId) {
    return apiSuccess({ error: "itemId required" }, { requestId: "missing" });
  }

  return withNotificationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    if (body.action === "dismiss") {
      const item = await unifiedInboxService.dismiss(
        organisationId,
        tenant!.userProfileId,
        itemId,
        tenant!,
      );
      return apiSuccess({ item }, { requestId });
    }
    if (body.action === "archive") {
      const item = await unifiedInboxService.archive(
        organisationId,
        tenant!.userProfileId,
        itemId,
        tenant!,
      );
      return apiSuccess({ item }, { requestId });
    }
    const item = await unifiedInboxService.markRead(
      organisationId,
      tenant!.userProfileId,
      itemId,
      tenant!,
    );
    return apiSuccess({ item }, { requestId });
  });
}
