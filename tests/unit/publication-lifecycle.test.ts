import { describe, expect, it } from "vitest";
import {
  assertPublicationTransition,
  isPublicationExecutable,
  isPublicationTerminal,
} from "@/lib/publishing/publication-lifecycle";

describe("publication lifecycle", () => {
  it("allows valid transitions", () => {
    expect(() => assertPublicationTransition("APPROVED", "QUEUED")).not.toThrow();
    expect(() => assertPublicationTransition("QUEUED", "PUBLISHING")).not.toThrow();
    expect(() => assertPublicationTransition("PUBLISHING", "PUBLISHED")).not.toThrow();
    expect(() => assertPublicationTransition("FAILED", "QUEUED")).not.toThrow();
    expect(() => assertPublicationTransition("SCHEDULED", "CANCELLED")).not.toThrow();
  });

  it("rejects invalid transitions", () => {
    expect(() => assertPublicationTransition("PUBLISHED", "QUEUED")).toThrow();
    expect(() => assertPublicationTransition("CANCELLED", "PUBLISHING")).toThrow();
  });

  it("identifies executable and terminal statuses", () => {
    expect(isPublicationExecutable("QUEUED")).toBe(true);
    expect(isPublicationExecutable("PUBLISHED")).toBe(false);
    expect(isPublicationTerminal("PUBLISHED")).toBe(true);
    expect(isPublicationTerminal("QUEUED")).toBe(false);
  });
});
