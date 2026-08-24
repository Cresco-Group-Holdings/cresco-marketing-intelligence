/**
 * Shared metric presentation states for Command Centre, Organic Growth, and other workspaces.
 * "unavailable" means the metric cannot be computed yet — distinct from zero ("empty"/"normal").
 */
export type MetricDisplayState =
  | "loading"
  | "empty"
  | "partial"
  | "stale"
  | "normal"
  | "unavailable";
