import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-subtle px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm font-semibold text-foreground">
            {APP_NAME}
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">Sign in</h1>
          <p className="mt-2 text-sm text-foreground-muted">
            Access your marketing workspace with email, password, or Google.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to continue to your workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<p className="text-sm text-foreground-muted">Loading sign-in...</p>}>
              <LoginForm />
            </Suspense>
            <p className="mt-4 text-center text-sm text-foreground-muted">
              <Link href="/forgot-password" className="font-medium text-foreground hover:underline">
                Forgot password?
              </Link>
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-foreground-muted">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-foreground hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
