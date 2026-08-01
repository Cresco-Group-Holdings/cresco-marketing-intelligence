import type { User } from "@supabase/supabase-js";
import type { Prisma } from "@prisma/client";
import { resolveAppUrl } from "@/lib/environment/app-url";
import {
  assertSignupAuthConfiguration,
  isAntiEnumerationSignupResponse,
  mapSignupAuthError,
  type SignUpOutcome,
} from "@/lib/auth/signup-errors";
import { AUTH_AUDIT_ACTIONS, AUTH_CALLBACK_PATH } from "@/lib/auth/constants";
import {
  ensureUserProfile,
  extractProviderMetadata,
  reconcileUserProfile,
  type ProvisionedUser,
} from "@/lib/auth/provisioning";
import { resolvePostAuthRedirectPath } from "@/lib/auth/post-auth";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { createSupabaseServiceClient } from "@/lib/auth/supabase-service";
import { getOAuthProvider } from "@/lib/auth/providers";
import { resolveSafeRedirectPath } from "@/lib/security/redirects";
import { securityAuditService } from "@/server/services/security-audit-service";

type AuditContext = {
  requestId?: string;
  ipAddress?: string;
};

function buildCallbackUrl(redirect?: string): string {
  const callback = new URL(AUTH_CALLBACK_PATH, resolveAppUrl());

  if (redirect) {
    callback.searchParams.set("redirect", resolveSafeRedirectPath(redirect, "/dashboard"));
  }

  return callback.toString();
}

export const authService = {
  async provisionFromAuthUser(
    user: User,
    audit?: AuditContext,
  ): Promise<ProvisionedUser & { redirectPath: string }> {
    const metadata = extractProviderMetadata(user.user_metadata);
    const provisioned = await ensureUserProfile({
      authUserId: user.id,
      email: user.email ?? "",
      ...metadata,
    });

    if (provisioned.created) {
      await securityAuditService.record({
        actorUserId: provisioned.userProfileId,
        action: AUTH_AUDIT_ACTIONS.SIGNUP,
        resourceType: "user_profile",
        resourceId: provisioned.userProfileId,
        requestId: audit?.requestId,
        ipAddress: audit?.ipAddress,
        metadata: {
          provider: user.app_metadata?.provider ?? "email",
        },
      });
    }

    const redirectPath = await resolvePostAuthRedirectPath(provisioned.userProfileId);

    return {
      ...provisioned,
      redirectPath,
    };
  },

  async recordLoginSucceeded(
    userProfileId: string,
    audit?: AuditContext,
    metadata?: Prisma.InputJsonValue,
  ) {
    await securityAuditService.record({
      actorUserId: userProfileId,
      action: AUTH_AUDIT_ACTIONS.LOGIN_SUCCEEDED,
      resourceType: "session",
      resourceId: userProfileId,
      requestId: audit?.requestId,
      ipAddress: audit?.ipAddress,
      metadata,
    });
  },

  async recordLoginFailed(audit?: AuditContext, metadata?: Prisma.InputJsonValue) {
    await securityAuditService.record({
      action: AUTH_AUDIT_ACTIONS.LOGIN_FAILED,
      resourceType: "session",
      requestId: audit?.requestId,
      ipAddress: audit?.ipAddress,
      metadata,
    });
  },

  async recordLogout(userProfileId: string, audit?: AuditContext) {
    await securityAuditService.record({
      actorUserId: userProfileId,
      action: AUTH_AUDIT_ACTIONS.LOGOUT,
      resourceType: "session",
      resourceId: userProfileId,
      requestId: audit?.requestId,
      ipAddress: audit?.ipAddress,
    });
  },

  async recordEmailVerified(userProfileId: string, audit?: AuditContext) {
    await securityAuditService.record({
      actorUserId: userProfileId,
      action: AUTH_AUDIT_ACTIONS.EMAIL_VERIFIED,
      resourceType: "user_profile",
      resourceId: userProfileId,
      requestId: audit?.requestId,
      ipAddress: audit?.ipAddress,
    });
  },

  async recordPasswordResetRequested(audit?: AuditContext) {
    await securityAuditService.record({
      action: AUTH_AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
      resourceType: "user_profile",
      requestId: audit?.requestId,
      ipAddress: audit?.ipAddress,
    });
  },

  async recordPasswordChanged(userProfileId: string, audit?: AuditContext) {
    await securityAuditService.record({
      actorUserId: userProfileId,
      action: AUTH_AUDIT_ACTIONS.PASSWORD_CHANGED,
      resourceType: "user_profile",
      resourceId: userProfileId,
      requestId: audit?.requestId,
      ipAddress: audit?.ipAddress,
    });
  },

  async recordOAuthConnected(
    userProfileId: string,
    provider: string,
    audit?: AuditContext,
  ) {
    await securityAuditService.record({
      actorUserId: userProfileId,
      action: AUTH_AUDIT_ACTIONS.OAUTH_CONNECTED,
      resourceType: "identity_provider",
      resourceId: provider,
      requestId: audit?.requestId,
      ipAddress: audit?.ipAddress,
      metadata: { provider },
    });
  },

  async recordSessionRevoked(userProfileId: string, audit?: AuditContext, scope?: string) {
    await securityAuditService.record({
      actorUserId: userProfileId,
      action: AUTH_AUDIT_ACTIONS.SESSION_REVOKED,
      resourceType: "session",
      resourceId: userProfileId,
      requestId: audit?.requestId,
      ipAddress: audit?.ipAddress,
      metadata: scope ? { scope } : undefined,
    });
  },

  async signUp(input: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
  }): Promise<SignUpOutcome> {
    assertSignupAuthConfiguration();

    const supabase = await createSupabaseServerClient();
    const displayName =
      input.displayName ??
      ([input.firstName, input.lastName].filter(Boolean).join(" ").trim() || undefined);

    let data;
    try {
      const result = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          emailRedirectTo: buildCallbackUrl("/dashboard"),
          data: {
            first_name: input.firstName,
            last_name: input.lastName,
            full_name: displayName,
          },
        },
      });

      if (result.error) {
        throw result.error;
      }

      data = result.data;
    } catch (error) {
      throw mapSignupAuthError(error, "supabase_signup");
    }

    if (!data.user) {
      throw mapSignupAuthError(new Error("Supabase signup returned no user."), "supabase_signup");
    }

    if (isAntiEnumerationSignupResponse(data.user)) {
      return {
        stage: "completed",
        userCreated: false,
        emailVerificationRequired: false,
        antiEnumeration: true,
      };
    }

    if (!data.user.email) {
      throw mapSignupAuthError(new Error("Supabase signup returned a user without an email."), "supabase_signup");
    }

    try {
      const provisioned = await reconcileUserProfile({
        authUserId: data.user.id,
        email: data.user.email,
        displayName,
        firstName: input.firstName,
        lastName: input.lastName,
      });

      if (provisioned.created) {
        await securityAuditService.record({
          actorUserId: provisioned.userProfileId,
          action: AUTH_AUDIT_ACTIONS.SIGNUP,
          resourceType: "user_profile",
          resourceId: provisioned.userProfileId,
          metadata: { provider: "email" },
        });
      }
    } catch (error) {
      throw mapSignupAuthError(error, "profile_provisioning");
    }

    return {
      stage: "completed",
      userCreated: true,
      emailVerificationRequired: !data.session,
      antiEnumeration: false,
      authUserId: data.user.id,
    };
  },

  async signInWithPassword(email: string, password: string) {
    const supabase = await createSupabaseServerClient();
    return supabase.auth.signInWithPassword({ email, password });
  },

  async signOut(scope: "local" | "global" | "others" = "local") {
    const supabase = await createSupabaseServerClient();
    return supabase.auth.signOut({ scope });
  },

  async requestPasswordReset(email: string) {
    const supabase = await createSupabaseServerClient();
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: buildCallbackUrl("/reset-password"),
    });
  },

  async updatePassword(password: string) {
    const supabase = await createSupabaseServerClient();
    return supabase.auth.updateUser({ password });
  },

  async verifyCurrentPassword(email: string, password: string) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return !error;
  },

  async resendVerificationEmail(email: string) {
    const supabase = await createSupabaseServerClient();
    return supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: buildCallbackUrl("/dashboard"),
      },
    });
  },

  async getCurrentSession() {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { user: null, session: null, identities: [] as Array<{ provider: string }> };
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const identities = (user.identities ?? []).map((identity) => ({
      provider: identity.provider,
      id: identity.id,
      createdAt: identity.created_at,
      updatedAt: identity.updated_at,
    }));

    return { user, session, identities };
  },

  async getOAuthSignInUrl(providerId: string, redirect?: string) {
    const provider = getOAuthProvider(providerId);
    if (!provider) {
      throw new Error("OAuth provider is not enabled.");
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider.supabaseProvider,
      options: {
        redirectTo: buildCallbackUrl(redirect),
        queryParams:
          provider.id === "google"
            ? {
                access_type: "offline",
                prompt: "consent",
              }
            : undefined,
      },
    });

    if (error || !data.url) {
      throw error ?? new Error("Unable to start OAuth flow.");
    }

    return data.url;
  },

  async revokeAllSessions(authUserId: string) {
    const serviceClient = createSupabaseServiceClient();
    return serviceClient.auth.admin.signOut(authUserId, "global");
  },
};
