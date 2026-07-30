import { OBJECTIVE_TRANSLATION, type MetaObjective } from "./constants";

export function translatePlanObjective(primaryObjective?: string | null): {
  metaObjective: string;
  label: string;
  supported: boolean;
} {
  if (!primaryObjective) {
    return { metaObjective: "OUTCOME_TRAFFIC", label: "Traffic (default)", supported: true };
  }
  const mapping = OBJECTIVE_TRANSLATION[primaryObjective];
  if (mapping) {
    return { metaObjective: mapping.meta, label: mapping.label, supported: true };
  }
  return { metaObjective: "OUTCOME_TRAFFIC", label: `Translated from ${primaryObjective}`, supported: false };
}

export function isSupportedObjective(objective: string): objective is MetaObjective {
  const values = Object.values(OBJECTIVE_TRANSLATION).map((m) => m.meta);
  return values.includes(objective);
}
