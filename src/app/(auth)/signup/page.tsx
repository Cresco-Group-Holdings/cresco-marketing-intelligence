import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupForm } from "@/components/auth/signup-form";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Create account",
};

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-subtle px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm font-semibold text-foreground">
            {APP_NAME}
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">Create your account</h1>
          <p className="mt-2 text-sm text-foreground-muted">
            Set up access to your organisation&apos;s marketing intelligence workspace.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>Create an account with email or Google.</CardDescription>
          </CardHeader>
          <CardContent>
            <SignupForm />
          </CardContent>
        </Card>

        <p className="text-center text-sm text-foreground-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
