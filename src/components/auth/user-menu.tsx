"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, Shield, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

type UserMenuProps = {
  email: string;
  displayName?: string | null;
};

export function UserMenu({ email, displayName }: UserMenuProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await apiFetch("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ scope: "local" }),
      });
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const label = displayName?.trim() || email;

  return (
    <div className="relative group">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm font-medium text-foreground-muted hover:bg-surface-subtle"
        aria-haspopup="menu"
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {label.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-[10rem] truncate sm:inline">{label}</span>
      </button>
      <div className="invisible absolute right-0 z-40 mt-2 w-56 rounded-lg border border-border bg-surface-elevated p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="border-b border-border-subtle px-3 py-2">
          <p className="truncate text-sm font-medium text-foreground">{label}</p>
          <p className="truncate text-xs text-foreground-subtle">{email}</p>
        </div>
        <div className="py-1">
          <Link
            href="/settings/account"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-subtle hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
            Account
          </Link>
          <Link
            href="/settings/security"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-subtle hover:text-foreground"
          >
            <Shield className="h-4 w-4" />
            Security
          </Link>
          <Link
            href="/settings/sessions"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-subtle hover:text-foreground"
          >
            <Monitor className="h-4 w-4" />
            Sessions
          </Link>
        </div>
        <div className="border-t border-border-subtle pt-1">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start gap-2 px-3"
            onClick={handleLogout}
            disabled={loading}
          >
            <LogOut className="h-4 w-4" />
            {loading ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </div>
    </div>
  );
}
