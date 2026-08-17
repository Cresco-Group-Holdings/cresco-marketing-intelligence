import type { CopilotModule, CopilotPageContext } from "@/lib/copilot/types";

const MODULE_ROUTES: Array<{ prefix: string; module: CopilotModule }> = [
  { prefix: "/advertising", module: "advertising" },
  { prefix: "/social", module: "social" },
  { prefix: "/content", module: "content" },
  { prefix: "/analytics", module: "analytics" },
  { prefix: "/calendar", module: "calendar" },
  { prefix: "/dashboard", module: "dashboard" },
  { prefix: "/copilot", module: "copilot" },
];

export function resolveModuleFromRoute(route: string): CopilotModule {
  for (const entry of MODULE_ROUTES) {
    if (route === entry.prefix || route.startsWith(`${entry.prefix}/`)) {
      return entry.module;
    }
  }
  if (route === "/" || route.startsWith("/dashboard")) {
    return "dashboard";
  }
  return "other";
}

export function buildPageContext(input: {
  route: string;
  dateRange?: CopilotPageContext["dateRange"];
  attributionModel?: string;
  entityType?: string;
  entityId?: string;
  activeFilters?: Record<string, unknown>;
}): CopilotPageContext {
  return {
    route: input.route,
    module: resolveModuleFromRoute(input.route),
    entityType: input.entityType,
    entityId: input.entityId,
    dateRange: input.dateRange,
    attributionModel: input.attributionModel,
    activeFilters: input.activeFilters,
  };
}

export function contextHintForModule(module: CopilotModule): string {
  switch (module) {
    case "advertising":
      return "User is in Paid Advertising. Interpret vague references as campaigns, channels, creatives, or budget.";
    case "social":
      return "User is in Organic Social. Interpret vague references as posts, formats, channels, or publishing.";
    case "content":
      return "User is in Content Studio. Interpret vague references as content items, drafts, or repurposing.";
    case "analytics":
      return "User is in Unified Analytics. Interpret vague references as attribution, channels, revenue, or funnels.";
    case "calendar":
      return "User is in Calendar. Interpret vague references as scheduled content or publishing gaps.";
    case "dashboard":
      return "User is on the Marketing Command Centre dashboard.";
    default:
      return "General marketing workspace context.";
  }
}
