import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm font-semibold text-slate-900">
            {APP_NAME}
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Sign in</h1>
          <p className="mt-2 text-sm text-slate-600">
            Access your marketing workspace with Supabase authentication.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>
              Authentication is configured through Supabase. Connect your project credentials to
              enable sign-in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" action="/auth/callback" method="get">
              <Input
                label="Email address"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                disabled
              />
              <Input
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                disabled
              />
              <ButtonLink href="/dashboard" className="w-full">
                Continue to platform (dev placeholder)
              </ButtonLink>
            </form>
            <p className="mt-4 text-center text-sm text-slate-600">
              <Link href="/forgot-password" className="font-medium text-slate-900 hover:underline">
                Forgot password?
              </Link>
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-600">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-slate-900 hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
