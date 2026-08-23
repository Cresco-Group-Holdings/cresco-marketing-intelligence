"use client";

import { ChevronRight } from "lucide-react";
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
    "h-8 rounded-md border border-border bg-surface-elevated px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    compact ? "w-full min-w-0" : "max-w-[11rem]",
  );

  const labelClass = cn(
    "text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle",
    compact ? "px-0.5" : "mb-0.5 block",
  );

  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-1.5",
        compact && "flex-col items-stretch gap-2",
      )}
      aria-label="Workspace context"
    >
      <label className={cn("flex flex-col", compact ? "w-full" : "min-w-0")}>
        <span className={labelClass}>Organisation</span>
        <select
          className={cn(selectClass, !compact && "min-w-[10rem] font-medium")}
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

      {!compact ? (
        <ChevronRight className="mb-2 hidden h-3.5 w-3.5 text-foreground-subtle lg:block" aria-hidden="true" />
      ) : null}

      <label className={cn("flex flex-col", compact ? "w-full" : "min-w-0")}>
        <span className={labelClass}>Project</span>
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

      {!compact ? (
        <ChevronRight className="mb-2 hidden h-3.5 w-3.5 text-foreground-subtle lg:block" aria-hidden="true" />
      ) : null}

      <label className={cn("flex flex-col", compact ? "w-full" : "min-w-0")}>
        <span className={labelClass}>Brand</span>
        <select
          className={cn(selectClass, !compact && "text-foreground-muted")}
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
