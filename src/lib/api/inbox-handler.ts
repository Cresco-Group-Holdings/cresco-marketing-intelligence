import { NextRequest } from "next/server";
import { withApiHandler, parseBody } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS, type Permission } from "@/lib/tenancy/permissions";
import { inboxListFiltersSchema } from "@/lib/validation/inbox";
import type { ConversationFilters } from "@/server/services/social-inbox-query-service";

export function requireOrganisationId(request: NextRequest): string {
  const organisationId =
    request.nextUrl.searchParams.get("organisationId") ??
    request.headers.get("x-organisation-id");

  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return organisationId;
}

function withInboxPermission(
  request: NextRequest,
  organisationId: string,
  permission: Permission,
  handler: Parameters<typeof withApiHandler>[1],
) {
  return withApiHandler(request, handler, { organisationId, permission });
}

export const withInboxRead = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withInboxPermission(request, organisationId, PERMISSIONS["socialInbox.read"], handler);

export const withInboxReply = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withInboxPermission(request, organisationId, PERMISSIONS["socialInbox.reply"], handler);

export const withInboxAssign = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withInboxPermission(request, organisationId, PERMISSIONS["socialInbox.assign"], handler);

export const withInboxModerate = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withInboxPermission(request, organisationId, PERMISSIONS["socialInbox.moderate"], handler);

export const withInboxResolve = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withInboxPermission(request, organisationId, PERMISSIONS["socialInbox.resolve"], handler);

export const withInboxExport = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withInboxPermission(request, organisationId, PERMISSIONS["socialInbox.export"], handler);

function rawInboxFilters(request: NextRequest) {
  const read = (key: string) => request.nextUrl.searchParams.get(key) ?? undefined;
  return {
    status: read("status"),
    priority: read("priority"),
    conversationType: read("conversationType"),
    provider: read("provider"),
    socialAccountId: read("socialAccountId"),
    assignedToUserId: read("assignedToUserId"),
    unreadOnly: read("unreadOnly"),
    requiresHumanReview: read("requiresHumanReview"),
    safetyFlag: read("safetyFlag"),
    tag: read("tag"),
    search: read("search"),
    from: read("from"),
    to: read("to"),
    cursor: read("cursor"),
    limit: read("limit"),
  };
}

/** Parses inbox list query parameters into service filters. */
export function inboxFilters(request: NextRequest): ConversationFilters {
  const parsed = parseBody(inboxListFiltersSchema, rawInboxFilters(request));
  return {
    status: parsed.status,
    priority: parsed.priority,
    conversationType: parsed.conversationType,
    provider: parsed.provider,
    socialAccountId: parsed.socialAccountId,
    assigneeUserId: parsed.assignedToUserId,
    unread: parsed.unreadOnly,
    requiresHumanReview: parsed.requiresHumanReview,
    safetyFlag: parsed.safetyFlag,
    tags: parsed.tag ? [parsed.tag] : undefined,
    search: parsed.search || undefined,
    from: parsed.from ? new Date(parsed.from) : undefined,
    to: parsed.to ? new Date(parsed.to) : undefined,
    cursor: parsed.cursor,
    limit: parsed.limit,
  };
}
