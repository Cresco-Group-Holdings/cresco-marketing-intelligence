"use client";

import { useWorkspace } from "@/components/workspace/workspace-provider";
import { cn } from "@/lib/utils";

type WorkspaceSelectorsProps = {
  compact?: boolean;
};

export function WorkspaceSelectors({ compact = false }: WorkspaceSelectorsProps) {
  const {
    organisations,
    projects,
    brands,
    preference,
    loading,
    setOrganisation,
    setProject,
    setBrand,
  } = useWorkspace();

  if (loading) {
    return <p className="text-xs text-foreground-subtle">Loading workspace…</p>;
  }

  const selectClass = cn(
    "h-9 rounded-lg border border-border-strong bg-surface-elevated px-3 text-sm text-foreground focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    compact ? "w-full min-w-0" : "min-w-[140px]",
  );

  return (
    <div className={cn("flex flex-wrap items-end gap-2", compact && "flex-col items-stretch")}>
      <label className="flex flex-col gap-1">
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle",
            compact ? "px-0.5" : "sr-only",
          )}
        >
          Organisation
        </span>
        <select
          className={selectClass}
          value={preference.currentOrganisationId ?? ""}
          onChange={(event) => void setOrganisation(event.target.value)}
          aria-label="Select organisation"
        >
          <option value="" disabled>
            Organisation
          </option>
          {organisations.map((organisation) => (
            <option key={organisation.id} value={organisation.id}>
              {organisation.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle",
            compact ? "px-0.5" : "sr-only",
          )}
        >
          Project
        </span>
        <select
          className={selectClass}
          value={preference.currentProjectId ?? ""}
          onChange={(event) => void setProject(event.target.value)}
          disabled={!preference.currentOrganisationId}
          aria-label="Select project"
        >
          <option value="" disabled>
            Project
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle",
            compact ? "px-0.5" : "sr-only",
          )}
        >
          Brand
        </span>
        <select
          className={selectClass}
          value={preference.currentBrandId ?? ""}
          onChange={(event) => void setBrand(event.target.value)}
          disabled={!preference.currentProjectId}
          aria-label="Select brand"
        >
          <option value="" disabled>
            Brand
          </option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
