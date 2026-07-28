import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Create account",
};

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm font-semibold text-slate-900">
            {APP_NAME}
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Create your account</h1>
          <p className="mt-2 text-sm text-slate-600">
            Set up access to your organisation&apos;s marketing intelligence workspace.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>
              Account provisioning will be connected to Supabase Auth in the next setup phase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Full name" name="fullName" autoComplete="name" disabled />
            <Input
              label="Work email"
              name="email"
              type="email"
              autoComplete="email"
              disabled
            />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              disabled
            />
            <ButtonLink href="/login" className="w-full">
              Return to sign in
            </ButtonLink>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
