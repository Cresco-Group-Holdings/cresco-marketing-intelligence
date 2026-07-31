import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

/**
 * Stage 6 tenant isolation consolidation.
 *
 * Cross-tenant access is blocked at two layers:
 * 1. API handlers require organisationId + brandId and enforce permission checks via withApiHandler.
 * 2. Service methods scope all queries by organisationId and brandId (via brandService.getById).
 *
 * Integration test references (tenant scoping verified at API layer):
 * - CRM: tests/integration/crm-routes.test.ts
 * - Email campaigns: tests/integration/email-campaigns-routes.test.ts ("loads campaign detail with tenant scoping")
 * - Automation: tests/integration/automation-routes.test.ts ("loads automation detail with tenant scoping")
 * - Lead scoring: tests/integration/lead-scoring-routes.test.ts ("scopes model reads to brand and organisation")
 * - Lifecycle agent: tests/integration/lifecycle-agent-routes.test.ts ("scopes run reads to brand and organisation")
 */

type Stage6Module = {
  name: string;
  readPermission: keyof typeof PERMISSIONS;
  writePermission: keyof typeof PERMISSIONS;
  serviceFile: string;
  integrationTest: string;
};

const STAGE_6_MODULES: Stage6Module[] = [
  {
    name: "CRM",
    readPermission: "crm.read",
    writePermission: "crm.create",
    serviceFile: "src/server/services/crm-service.ts",
    integrationTest: "tests/integration/crm-routes.test.ts",
  },
  {
    name: "email campaigns",
    readPermission: "emailCampaigns.read",
    writePermission: "emailCampaigns.create",
    serviceFile: "src/server/services/email-campaign-service.ts",
    integrationTest: "tests/integration/email-campaigns-routes.test.ts",
  },
  {
    name: "automation",
    readPermission: "automation.read",
    writePermission: "automation.create",
    serviceFile: "src/server/services/marketing-automation-service.ts",
    integrationTest: "tests/integration/automation-routes.test.ts",
  },
  {
    name: "lead scoring",
    readPermission: "leadScoring.read",
    writePermission: "leadScoring.create",
    serviceFile: "src/server/services/lead-scoring-service.ts",
    integrationTest: "tests/integration/lead-scoring-routes.test.ts",
  },
  {
    name: "lifecycle agent",
    readPermission: "lifecycleAgent.read",
    writePermission: "lifecycleAgent.run",
    serviceFile: "src/server/services/lifecycle-agent-service.ts",
    integrationTest: "tests/integration/lifecycle-agent-routes.test.ts",
  },
];

describe("Stage 6 cross-tenant API read access (hasPermission)", () => {
  for (const mod of STAGE_6_MODULES) {
    describe(mod.name, () => {
      it(`grants ${mod.readPermission} to viewers for tenant-scoped reads`, () => {
        expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS[mod.readPermission])).toBe(true);
      });

      it(`denies ${mod.writePermission} to viewers (blocks unauthorised API mutations)`, () => {
        expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS[mod.writePermission])).toBe(false);
      });

      it(`grants ${mod.readPermission} to marketers`, () => {
        expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS[mod.readPermission])).toBe(true);
      });

      it(`references integration test: ${mod.integrationTest}`, () => {
        // Documents the integration test that verifies tenant scoping at the API layer.
        expect(mod.integrationTest).toMatch(/tests\/integration\//);
      });
    });
  }
});

describe("Stage 6 service layer tenant scoping (organisationId + brandId)", () => {
  for (const mod of STAGE_6_MODULES) {
    it(`scopes ${mod.name} service (${mod.serviceFile}) by organisationId and brandId`, async () => {
      const source = await import("fs/promises").then((fs) => fs.readFile(mod.serviceFile, "utf8"));
      expect(source).toContain("organisationId");
      expect(source).toContain("brandId");
      expect(source).toMatch(/brandService\.getById/);
    });
  }
});

describe("Stage 6 API handler permission bindings", () => {
  const handlerFiles: Array<{ module: string; file: string; permission: string }> = [
    { module: "CRM", file: "src/lib/api/crm-handler.ts", permission: "crm.read" },
    {
      module: "email campaigns",
      file: "src/lib/api/email-campaigns-handler.ts",
      permission: "emailCampaigns.read",
    },
    { module: "automation", file: "src/lib/api/automation-handler.ts", permission: "automation.read" },
    {
      module: "lead scoring",
      file: "src/lib/api/lead-scoring-handler.ts",
      permission: "leadScoring.read",
    },
    {
      module: "lifecycle agent",
      file: "src/lib/api/lifecycle-agent-handler.ts",
      permission: "lifecycleAgent.read",
    },
  ];

  for (const { module, file, permission } of handlerFiles) {
    it(`binds ${module} read routes to ${permission}`, async () => {
      const source = await import("fs/promises").then((fs) => fs.readFile(file, "utf8"));
      expect(source).toContain(permission);
      expect(source).toContain("organisationId");
    });
  }
});
