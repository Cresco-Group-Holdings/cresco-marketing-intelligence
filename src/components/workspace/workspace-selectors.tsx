"use client";

import { useWorkspace } from "@/components/workspace/workspace-provider";

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
    return <p className="text-xs text-slate-500">Loading workspace…</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex flex-col gap-1">
        <span className="sr-only">Select organisation</span>
        <select
          className="h-9 min-w-[140px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus-visible:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
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
          className="h-9 min-w-[140px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus-visible:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
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
          className="h-9 min-w-[140px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus-visible:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
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
