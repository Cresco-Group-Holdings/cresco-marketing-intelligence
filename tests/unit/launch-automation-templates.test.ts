import { describe, expect, it } from "vitest";
import {
  LAUNCH_AUTOMATION_TEMPLATES,
  getLaunchTemplate,
  groupTemplatesByCategory,
} from "@/lib/automation-engine/launch-templates";

describe("launch automation templates", () => {
  it("defines all seven launch templates", () => {
    expect(LAUNCH_AUTOMATION_TEMPLATES).toHaveLength(7);
    const keys = LAUNCH_AUTOMATION_TEMPLATES.map((template) => template.key);
    expect(keys).toContain("weekly-marketing-digest");
    expect(keys).toContain("publishing-failure-alert");
    expect(keys).toContain("data-sync-failure-alert");
    expect(keys).toContain("performance-anomaly-alert");
    expect(keys).toContain("no-content-scheduled-alert");
    expect(keys).toContain("winning-content-repurpose");
    expect(keys).toContain("campaign-review-reminder");
  });

  it("groups templates by outcome category", () => {
    const grouped = groupTemplatesByCategory();
    expect(grouped.monitor?.length).toBeGreaterThan(0);
    expect(grouped.reporting?.length).toBeGreaterThan(0);
  });

  it("does not require approval for launch templates", () => {
    for (const template of LAUNCH_AUTOMATION_TEMPLATES) {
      expect(template.requiresApproval).toBe(false);
    }
  });

  it("resolves template by key", () => {
    expect(getLaunchTemplate("weekly-marketing-digest")?.name).toBe("Weekly Marketing Digest");
  });
});
