"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SEARCH_ROUTES = [
  { label: "Command Centre", href: "/dashboard", keywords: "dashboard home cockpit" },
  { label: "Advertising", href: "/advertising", keywords: "paid ads campaigns" },
  { label: "Campaigns", href: "/campaigns", keywords: "campaign planning" },
  { label: "Organic Social", href: "/social", keywords: "social organic reels" },
  { label: "Content Studio", href: "/content", keywords: "content draft posts" },
  { label: "Calendar", href: "/calendar", keywords: "schedule publishing" },
  { label: "Analytics", href: "/analytics", keywords: "performance metrics" },
  { label: "Attribution", href: "/analytics/attribution", keywords: "attribution journeys" },
  { label: "Audiences", href: "/advertising/audiences", keywords: "targeting segments" },
  { label: "Integrations", href: "/integrations", keywords: "connectors providers" },
  { label: "Ask Cresco", href: "/copilot", keywords: "ai copilot intelligence" },
  { label: "Cresco Intelligence", href: "/growth", keywords: "insights recommendations" },
  { label: "Operations", href: "/operations", keywords: "alerts activity failures" },
  { label: "Settings", href: "/settings", keywords: "account organisation" },
] as const;

type GlobalSearchProps = {
  className?: string;
};

export function GlobalSearch({ className }: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results =
    query.trim().length === 0
      ? []
      : SEARCH_ROUTES.filter((route) => {
          const haystack = `${route.label} ${route.keywords}`.toLowerCase();
          return haystack.includes(query.trim().toLowerCase());
        }).slice(0, 8);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    }
    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      navigate(results[activeIndex].href);
    }
  }

  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <label className="sr-only" htmlFor="global-search">
        Search campaigns, content, insights, audiences
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-subtle"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          id="global-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search campaigns, content, insights…"
          className="h-9 w-full border-border-strong bg-surface pl-9 pr-16 text-sm"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="global-search-results"
          aria-autocomplete="list"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-surface-subtle px-1.5 py-0.5 text-[10px] font-medium text-foreground-subtle sm:inline">
          ⌘K
        </kbd>
      </div>

      {open && results.length > 0 ? (
        <ul
          id="global-search-results"
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface-elevated py-1 shadow-lg"
        >
          {results.map((result, index) => (
            <li key={result.href} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left text-sm",
                  index === activeIndex
                    ? "bg-surface-selected text-foreground"
                    : "text-foreground-muted hover:bg-surface-hover",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => navigate(result.href)}
              >
                <span>{result.label}</span>
                <span className="text-xs text-foreground-subtle">{result.href}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
