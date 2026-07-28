import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm font-semibold text-slate-900">
            {APP_NAME}
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Reset your password</h1>
          <p className="mt-2 text-sm text-slate-600">
            Password recovery will be handled through Supabase once authentication is configured.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Password recovery</CardTitle>
            <CardDescription>
              Enter your email address and we will send reset instructions when auth is connected.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Email address" name="email" type="email" autoComplete="email" disabled />
            <ButtonLink href="/login" className="w-full">
              Back to sign in
            </ButtonLink>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
