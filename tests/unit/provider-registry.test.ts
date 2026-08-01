import { describe, expect, it } from "vitest";
import {
  getProviderDefinition,
  listEnabledProviders,
  listProviderDefinitions,
  supportsCapability,
  validateProviderConfiguration,
} from "@/lib/providers/registry";

describe("provider registry", () => {
  it("lists all provider definitions", () => {
    const definitions = listProviderDefinitions();
    expect(definitions.length).toBeGreaterThan(20);
    expect(definitions.some((item) => item.key === "google-analytics")).toBe(true);
  });

  it("returns disabled providers by default", () => {
    const meta = getProviderDefinition("meta");
    expect(meta).toBeDefined();
    expect(meta?.enabled).toBe(false);
  });

  it("lists only enabled providers", () => {
    const enabled = listEnabledProviders();
    expect(enabled.every((item) => item.enabled)).toBe(true);
    expect(enabled.some((item) => item.key === "csv-import")).toBe(true);
  });

  it("checks capability support", () => {
    expect(supportsCapability("google-analytics", "ANALYTICS_PULL")).toBe(true);
    expect(supportsCapability("smtp", "ADVERTISING_MANAGE")).toBe(false);
  });

  it("validates required configuration fields", () => {
    const result = validateProviderConfiguration("google-analytics", {});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: propertyId");
  });
});
