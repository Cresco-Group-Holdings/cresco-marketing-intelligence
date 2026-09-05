import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRequestId, apiSuccess, handleApiError } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import { ensureUserProfile, extractProviderMetadata } from "@/lib/auth/provisioning";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { hasPermission, type Permission } from "@/lib/tenancy/permissions";
import {
  buildTenantContext,
  type AuthenticatedUser,
} from "@/lib/tenancy/guards";
import { runWithTenantContext, type TenantContext } from "@/lib/tenancy/context";
import { resolveHarnessAuthUserIdFromRequest } from "@/lib/e2e/test-auth";
import { isTestAuthBypassEnabled } from "@/lib/security/production-guards";

export type ApiHandlerContext = {
  request: NextRequest;
  requestId: string;
  user: AuthenticatedUser;
  tenant?: TenantContext;
};

export async function resolveApiUser(request?: NextRequest): Promise<AuthenticatedUser> {
  if (isTestAuthBypassEnabled()) {
    const testUserId =
      (request ? resolveHarnessAuthUserIdFromRequest(request) : null) ??
      process.env.TEST_AUTH_USER_ID;
    const testEmail = process.env.TEST_AUTH_EMAIL ?? "test@example.com";
    if (testUserId) {
      const provisioned = await ensureUserProfile({
        authUserId: testUserId,
        email: testEmail,
        displayName: "Test User",
      });
      return {
        userId: provisioned.authUserId,
        email: provisioned.email,
        userProfileId: provisioned.userProfileId,
      };
    }
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    throw new AppError("UNAUTHORIZED", "Authentication is required.");
  }

  const metadata = extractProviderMetadata(user.user_metadata);
  const provisioned = await ensureUserProfile({
    authUserId: user.id,
    email: user.email,
    ...metadata,
  });

  return {
    userId: provisioned.authUserId,
    email: provisioned.email,
    userProfileId: provisioned.userProfileId,
  };
}

export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      parsed.error.issues.map((issue) => issue.message).join(", "),
    );
  }

  return parsed.data;
}

export async function withApiHandler(
  request: NextRequest,
  handler: (context: ApiHandlerContext) => Promise<NextResponse>,
  options?: {
    organisationId?: string | null;
    projectId?: string | null;
    permission?: Permission;
  },
): Promise<NextResponse> {
  const requestId = createRequestId();

  try {
    const user = await resolveApiUser(request);

    let tenant: TenantContext | undefined;
    if (options?.organisationId) {
      tenant = await buildTenantContext({
        organisationId: options.organisationId,
        projectId: options.projectId ?? undefined,
      });

      if (options.permission && !hasPermission(tenant.organisationRole, options.permission)) {
        throw new AppError("FORBIDDEN", "You do not have permission for this action.");
      }

      return await runWithTenantContext(tenant, () =>
        handler({ request, requestId, user, tenant }),
      );
    }

    return await handler({ request, requestId, user, tenant });
  } catch (error) {
    return handleApiError(error, requestId, {
      route: request.nextUrl.pathname,
      organisationId: options?.organisationId ?? getOrganisationIdFromRequest(request),
    });
  }
}

export function getOrganisationIdFromRequest(request: NextRequest): string | null {
  return (
    request.nextUrl.searchParams.get("organisationId") ??
    request.headers.get("x-organisation-id")
  );
}

export function getProjectIdFromRequest(request: NextRequest): string | null {
  return request.nextUrl.searchParams.get("projectId") ?? request.headers.get("x-project-id");
}

export async function jsonBody<T>(request: NextRequest): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}

export { apiSuccess };
