import { test as base, expect } from "@playwright/test";
import {
  attachLaunchGates,
  assertLaunchGates,
  type LaunchGateContext,
} from "./gates";
import { authHeaders, isLaunchE2eEnabled, loadTenantManifest } from "./environment";

type LaunchFixtures = {
  launchGates: LaunchGateContext;
  tenantManifest: ReturnType<typeof loadTenantManifest>;
  ownerPage: LaunchGateContext["page"];
  memberPage: LaunchGateContext["page"];
};

export const test = base.extend<LaunchFixtures>({
  tenantManifest: async ({}, use, testInfo) => {
    if (!isLaunchE2eEnabled()) {
      testInfo.skip(true, "Requires CRESCO_E2E_HARNESS=true and ALLOW_TEST_AUTH=true");
    }
    await use(loadTenantManifest());
  },

  launchGates: async ({ page }, use, testInfo) => {
    if (!isLaunchE2eEnabled()) {
      testInfo.skip(true, "Requires CRESCO_E2E_HARNESS=true and ALLOW_TEST_AUTH=true");
    }
    const gates = attachLaunchGates(page, testInfo);
    await use(gates);
    assertLaunchGates(gates);
    gates.stop();
  },

  ownerPage: async ({ browser, tenantManifest }, use, testInfo) => {
    if (!isLaunchE2eEnabled()) {
      testInfo.skip(true, "Requires CRESCO_E2E_HARNESS=true and ALLOW_TEST_AUTH=true");
    }
    const context = await browser.newContext({
      extraHTTPHeaders: authHeaders(tenantManifest.tenantA.users.owner.authUserId),
    });
    const page = await context.newPage();
    const gates = attachLaunchGates(page, testInfo);
    await use(page);
    assertLaunchGates(gates);
    gates.stop();
    await context.close();
  },

  memberPage: async ({ browser, tenantManifest }, use, testInfo) => {
    if (!isLaunchE2eEnabled()) {
      testInfo.skip(true, "Requires CRESCO_E2E_HARNESS=true and ALLOW_TEST_AUTH=true");
    }
    const context = await browser.newContext({
      extraHTTPHeaders: authHeaders(tenantManifest.tenantA.users.member.authUserId),
    });
    const page = await context.newPage();
    const gates = attachLaunchGates(page, testInfo);
    await use(page);
    assertLaunchGates(gates);
    gates.stop();
    await context.close();
  },
});

export { expect };
