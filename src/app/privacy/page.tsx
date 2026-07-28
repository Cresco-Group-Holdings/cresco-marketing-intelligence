import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Link href="/" className="text-sm font-medium text-slate-700 hover:text-slate-900">
        ← Back to home
      </Link>
      <h1 className="mt-6 text-3xl font-semibold text-slate-900">Privacy Policy</h1>
      <p className="mt-4 text-sm text-slate-600">
        This placeholder policy will be replaced with a production privacy notice before public
        launch. {APP_NAME} is being built with tenant isolation, least-privilege access, and secure
        handling of marketing data.
      </p>
    </div>
  );
}
