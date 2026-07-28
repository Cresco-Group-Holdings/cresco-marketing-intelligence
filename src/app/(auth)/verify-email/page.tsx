import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VerifyEmailPanel } from "@/components/auth/verify-email-panel";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Verify email",
};

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm font-semibold text-slate-900">
            {APP_NAME}
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Verify your email</h1>
          <p className="mt-2 text-sm text-slate-600">
            Check your inbox for a verification link before signing in.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Verification required</CardTitle>
            <CardDescription>
              Didn&apos;t receive the email? Request another verification message below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VerifyEmailPanel />
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-600">
          <Link href="/login" className="font-medium text-slate-900 hover:underline">
            Return to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
