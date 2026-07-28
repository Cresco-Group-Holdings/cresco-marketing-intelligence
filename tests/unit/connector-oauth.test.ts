import { describe, expect, it } from "vitest";
import {
  generateOAuthState,
  generatePkceChallenge,
  generatePkceVerifier,
  inspectGrantedScopes,
  scopesSatisfyRequirement,
} from "@/lib/connectors/oauth/utils";

describe("connector oauth utilities", () => {
  it("generates unique oauth state values", () => {
    const first = generateOAuthState();
    const second = generateOAuthState();
    expect(first).not.toEqual(second);
    expect(first.length).toBeGreaterThan(20);
  });

  it("generates valid pkce challenge pairs", () => {
    const verifier = generatePkceVerifier();
    const challenge = generatePkceChallenge(verifier);
    expect(verifier).not.toEqual(challenge);
    expect(challenge.length).toBeGreaterThan(10);
  });

  it("validates required scopes", () => {
    const granted = ["read", "write"];
    expect(scopesSatisfyRequirement(granted, ["read"])).toBe(true);
    expect(inspectGrantedScopes(granted, ["read"], ["admin"]).isSufficient).toBe(true);
    expect(inspectGrantedScopes(granted, ["read", "billing"], []).missingRequired).toEqual([
      "billing",
    ]);
  });
});
