import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Authentication error",
};

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  oauth_failed: {
    title: "Sign-in was cancelled or failed",
    description: "The identity provider did not complete sign-in. Try again or use email and password.",
  },
  missing_code: {
    title: "Invalid authentication response",
    description: "The sign-in response was incomplete. Start sign-in again from the login page.",
  },
  missing_confirmation: {
    title: "Invalid authentication response",
    description:
      "The confirmation link was incomplete. Request a new verification email and open the latest link once.",
  },
  invalid_callback: {
    title: "Authentication link expired",
    description: "This sign-in link is no longer valid. Request a new sign-in or reset email.",
  },
  callback_expired: {
    title: "Confirmation link expired",
    description:
      "This verification link has expired. Request a new confirmation email from the sign-in page and use the newest link.",
  },
  callback_used: {
    title: "Confirmation link already used",
    description:
      "This verification link has already been used. Sign in with your email and password, or request a new confirmation email.",
  },
  callback_pkce_verifier: {
    title: "Open the link on the same device",
    description:
      "This confirmation link must be opened in the same browser where you signed up, or you need a link generated for server-side verification. Request a new confirmation email and use the latest link.",
  },
  provisioning_failed: {
    title: "Account setup is still pending",
    description:
      "Your email was confirmed, but profile setup could not be completed. Try signing in again in a moment.",
  },
  missing_user: {
    title: "Account could not be loaded",
    description: "We could not load your account after sign-in. Try signing in again.",
  },
  membership_suspended: {
    title: "Workspace access suspended",
    description:
      "Your membership in this workspace has been suspended. Contact your organisation administrator.",
  },
  default: {
    title: "Something went wrong",
    description: "An authentication error occurred. Try signing in again.",
  },
};

type AuthErrorPageProps = {
  searchParams: Promise<{ code?: string }>;
};

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const params = await searchParams;
  const error = ERROR_MESSAGES[params.code ?? ""] ?? ERROR_MESSAGES.default;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm font-semibold text-slate-900">
            {APP_NAME}
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">{error.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{error.description}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>What you can do next</CardTitle>
            <CardDescription>Return to a safe page and try again.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ButtonLink href="/login" className="w-full">
              Back to sign in
            </ButtonLink>
            <ButtonLink href="/" variant="outline" className="w-full">
              Go to homepage
            </ButtonLink>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
