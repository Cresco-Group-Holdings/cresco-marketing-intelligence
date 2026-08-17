"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function IntegrationsCallbackPage() {
  const searchParams = useSearchParams();
  const isError = searchParams.get("integration") === "error";
  const message = searchParams.get("message") ?? "An unknown error occurred.";
  const provider = searchParams.get("provider");

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-lg border p-6 text-center">
        {isError ? (
          <>
            <AlertCircle className="mx-auto h-10 w-10 text-danger" />
            <h1 className="text-lg font-semibold">Connection failed</h1>
            {provider ? <p className="text-sm text-muted-foreground">Provider: {provider}</p> : null}
            <p className="text-sm text-red-700">{message}</p>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
            <h1 className="text-lg font-semibold">Connection successful</h1>
            <p className="text-sm text-muted-foreground">Your integration is ready to configure.</p>
          </>
        )}
        <Link href="/integrations" className="inline-block rounded-md border px-4 py-2 text-sm">
          Back to integrations
        </Link>
      </div>
    </div>
  );
}
