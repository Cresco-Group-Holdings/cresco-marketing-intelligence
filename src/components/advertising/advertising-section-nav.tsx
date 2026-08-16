"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type AdvertisingSectionTab = {
  label: string;
  href: string;
  active: boolean;
};

export function AdvertisingSectionNav({
  tabs,
  ariaLabel = "Advertising section navigation",
}: {
  tabs: AdvertisingSectionTab[];
  ariaLabel?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="border-b border-border">
      <ul className="-mb-px flex gap-1 overflow-x-auto pb-px">
        {tabs.map((tab) => (
          <li key={tab.href} className="shrink-0">
            <Link
              href={tab.href}
              className={cn(
                "inline-flex items-center border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                tab.active
                  ? "border-paid-accent text-foreground"
                  : "border-transparent text-foreground-muted hover:border-border-strong hover:text-foreground",
              )}
              aria-current={tab.active ? "page" : undefined}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
