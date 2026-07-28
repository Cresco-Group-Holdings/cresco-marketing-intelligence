import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Link href="/" className="text-sm font-medium text-slate-700 hover:text-slate-900">
        ← Back to home
      </Link>
      <h1 className="mt-6 text-3xl font-semibold text-slate-900">Terms of Service</h1>
      <p className="mt-4 text-sm text-slate-600">
        These placeholder terms will be finalised before general availability. Use of {APP_NAME} is
        currently limited to internal platform development and evaluation.
      </p>
    </div>
  );
}
