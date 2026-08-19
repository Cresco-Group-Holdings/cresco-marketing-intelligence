import { describe, expect, it } from "vitest";
import {
  assertPublicationTransition,
  mapTokenFailureToPublicationStatus,
} from "@/lib/publishing/publication-lifecycle";
import { canRetryPublication } from "@/lib/publishing/publication-governance";
import { publicationStatusLabel } from "@/lib/publishing/publication-status-labels";

describe("publication lifecycle — organic social", () => {
  it("maps token failures to REQUIRES_REAUTH", () => {
    expect(mapTokenFailureToPublicationStatus("REAUTH_REQUIRED")).toEqual({
      status: "REQUIRES_REAUTH",
      errorCode: "REAUTH_REQUIRED",
    });
  });

  it("allows retry after reauth required", () => {
    expect(canRetryPublication("REQUIRES_REAUTH")).toBe(true);
    expect(() => assertPublicationTransition("REQUIRES_REAUTH", "QUEUED")).not.toThrow();
  });

  it("labels customer-facing statuses", () => {
    expect(publicationStatusLabel("REQUIRES_REAUTH")).toBe("Reconnect required");
    expect(publicationStatusLabel("PUBLISHING")).toBe("Publishing");
  });
});
