import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Link href="/" className="text-sm font-medium text-foreground-muted hover:text-foreground">
        ← Back to home
      </Link>
      <h1 className="mt-6 text-3xl font-semibold text-foreground">Terms of Service</h1>
      <p className="mt-4 text-sm text-foreground-muted">
        These placeholder terms will be finalised before general availability. Use of {APP_NAME} is
        currently limited to internal platform development and evaluation.
      </p>
    </div>
  );
}
