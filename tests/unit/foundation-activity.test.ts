import { describe, expect, it } from "vitest";
import {
  formatAuditActivityLabel,
  isFoundationAuditAction,
} from "@/lib/foundation/activity";

describe("foundation activity formatting", () => {
  it("maps known audit actions to readable labels", () => {
    expect(formatAuditActivityLabel("connector.connect.complete", "ConnectorAccount")).toBe(
      "Connector configured",
    );
    expect(formatAuditActivityLabel("marketingAsset.uploaded", "MarketingAsset")).toBe(
      "Asset uploaded",
    );
    expect(formatAuditActivityLabel("member.invited", "Invitation")).toBe("Member invited");
  });

  it("filters foundation-related audit actions", () => {
    expect(isFoundationAuditAction("brand.updated")).toBe(true);
    expect(isFoundationAuditAction("connector.disconnect")).toBe(true);
    expect(isFoundationAuditAction("system.heartbeat")).toBe(false);
  });
});
