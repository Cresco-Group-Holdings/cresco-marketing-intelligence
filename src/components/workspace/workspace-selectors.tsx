"use client";

import { useWorkspace } from "@/components/workspace/workspace-provider";

const selectClassName =
  "h-9 min-w-[140px] rounded-lg border border-border bg-surface-elevated px-3 text-sm text-foreground focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function WorkspaceSelectors() {
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex flex-col gap-1">
        <span className="sr-only">Select organisation</span>
        <select
          className={selectClassName}
          value={preference.currentOrganisationId ?? ""}
          onChange={(event) => void setOrganisation(event.target.value)}
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
        <span className="sr-only">Select project</span>
        <select
          className={selectClassName}
          value={preference.currentProjectId ?? ""}
          onChange={(event) => void setProject(event.target.value)}
          disabled={!preference.currentOrganisationId}
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
        <span className="sr-only">Select brand</span>
        <select
          className={selectClassName}
          value={preference.currentBrandId ?? ""}
          onChange={(event) => void setBrand(event.target.value)}
          disabled={!preference.currentProjectId}
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
