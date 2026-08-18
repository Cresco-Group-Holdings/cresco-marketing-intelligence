#!/usr/bin/env node

/**
 * Live database audit for Supabase public schema exposure.
 *
 * Usage:
 *   ANALYTICS_TEST_DATABASE_URL="postgresql://..." node scripts/audit-rls-exposure.mjs
 *   ANALYTICS_TEST_DATABASE_URL="..." node scripts/audit-rls-exposure.mjs --json > audit.json
 */

import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.ANALYTICS_TEST_DATABASE_URL ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const jsonOutput = process.argv.includes("--json");

if (!databaseUrl) {
  console.error("Set ANALYTICS_TEST_DATABASE_URL, DIRECT_URL, or DATABASE_URL.");
  process.exit(1);
}

const API_ROLES = ["anon", "authenticated", "service_role"];
const PRIVILEGES = ["SELECT", "INSERT", "UPDATE", "DELETE"];

const SENSITIVE_TABLES = [
  "_prisma_migrations",
  "Organisation",
  "OrganisationMembership",
  "UserProfile",
  "SocialCredential",
  "ProviderConnection",
  "PublishingJob",
  "PublishingAttempt",
  "SocialInboxMessage",
  "MarketingAnalyticsSnapshot",
  "BillingSubscription",
  "SecurityAuditLog",
  "WebhookDelivery",
  "DomainEvent",
];

function mapSecurityClass(model) {
  if (model.table === "_prisma_migrations") {
    return "D";
  }
  if (model.dataApiExposure) {
    return model.intentionallyPublicRead ? "C" : "B";
  }
  return "A";
}

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    const existingRoles = (
      await prisma.$queryRaw`SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role', 'PUBLIC')`
    ).map((r) => r.rolname);

    const tables = await prisma.$queryRaw`
      SELECT
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced,
        pg_get_userbyid(c.relowner) AS owner,
        (SELECT COUNT(*)::int FROM pg_policy pol WHERE pol.polrelid = c.oid) AS policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `;

    const publicGrants = await prisma.$queryRaw`
      SELECT c.relname AS table_name, acl.privilege_type
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', n.oid))) acl
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND acl.grantee = 0
      ORDER BY c.relname, acl.privilege_type
    `;

    const roleExposure = [];
    for (const role of API_ROLES) {
      if (!existingRoles.includes(role)) {
        continue;
      }
      for (const table of tables) {
        for (const privilege of PRIVILEGES) {
          const rows = await prisma.$queryRaw`
            SELECT has_table_privilege(
              ${role},
              ${`public."${table.table_name}"`},
              ${privilege}
            ) AS allowed
          `;
          if (rows[0]?.allowed) {
            roleExposure.push({ role, table: table.table_name, privilege });
          }
        }
      }
    }

    const rlsDisabled = tables.filter((t) => !t.rls_enabled);
    const tablesWithPolicies = tables.filter((t) => t.policy_count > 0);

    let inventory = null;
    try {
      const { readFileSync } = await import("node:fs");
      const { join } = await import("node:path");
      inventory = JSON.parse(readFileSync(join(process.cwd(), "docs/SUPABASE_RLS_INVENTORY.json"), "utf8"));
    } catch {
      inventory = null;
    }

    const report = {
      auditedAt: new Date().toISOString(),
      databaseUrlHost: databaseUrl.replace(/:[^:@/]+@/, ":***@").split("?")[0],
      summary: {
        totalPublicTables: tables.length,
        rlsEnabled: tables.filter((t) => t.rls_enabled).length,
        rlsDisabled: rlsDisabled.length,
        rlsForced: tables.filter((t) => t.rls_forced).length,
        tablesWithPolicies: tablesWithPolicies.length,
        publicRoleTableGrants: publicGrants.length,
        apiRoleExposures: roleExposure.length,
        unauthenticatedCanSelect: roleExposure.some((e) => e.role === "anon" && e.privilege === "SELECT"),
        unauthenticatedCanInsert: roleExposure.some((e) => e.role === "anon" && e.privilege === "INSERT"),
        unauthenticatedCanUpdate: roleExposure.some((e) => e.role === "anon" && e.privilege === "UPDATE"),
        unauthenticatedCanDelete: roleExposure.some((e) => e.role === "anon" && e.privilege === "DELETE"),
      },
      securityClassification: inventory
        ? {
            A_backendOnly: inventory.models.filter((m) => mapSecurityClass(m) === "A").length,
            B_authenticatedClient: inventory.models.filter((m) => mapSecurityClass(m) === "B").length,
            C_publicRead: inventory.models.filter((m) => mapSecurityClass(m) === "C").length,
            D_internalSystem: inventory.models.filter((m) => mapSecurityClass(m) === "D").length,
          }
        : null,
      rlsDisabledTables: rlsDisabled.map((t) => t.table_name),
      publicGrants,
      apiRoleExposures: roleExposure,
      sensitiveTableAudit: [],
      tablesWithPolicies: tablesWithPolicies.map((t) => ({
        table: t.table_name,
        policyCount: t.policy_count,
      })),
    };

    for (const name of SENSITIVE_TABLES) {
      const table = tables.find((t) => t.table_name === name);
      if (!table) {
        continue;
      }
      const exposure = {};
      for (const role of API_ROLES) {
        if (!existingRoles.includes(role)) {
          continue;
        }
        exposure[role] = {};
        for (const privilege of PRIVILEGES) {
          const rows = await prisma.$queryRaw`
            SELECT has_table_privilege(
              ${role},
              ${`public."${name}"`},
              ${privilege}
            ) AS allowed
          `;
          exposure[role][privilege] = rows[0]?.allowed ?? false;
        }
      }
      const publicRows = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS grant_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', n.oid))) acl
        WHERE n.nspname = 'public' AND c.relname = ${name} AND c.relkind = 'r' AND acl.grantee = 0
      `;
      exposure.PUBLIC = {
        anyGrant: (publicRows[0]?.grant_count ?? 0) > 0,
      };
      report.sensitiveTableAudit.push({
        table: name,
        rlsEnabled: table.rls_enabled,
        rlsForced: table.rls_forced,
        policyCount: table.policy_count,
        owner: table.owner,
        exposure,
      });
    }

    if (jsonOutput) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log("Supabase public schema exposure audit\n");
      console.log("Summary:");
      console.table(report.summary);
      if (report.securityClassification) {
        console.log("\nSecurity classification (from inventory):");
        console.table(report.securityClassification);
      }
      if (rlsDisabled.length > 0) {
        console.log("\nRLS DISABLED tables:", rlsDisabled.map((t) => t.table_name).join(", "));
      }
      if (roleExposure.length > 0) {
        console.log("\nAPI role exposures:");
        console.table(roleExposure);
      } else {
        console.log("\nNo API role table privileges detected.");
      }
      console.log("\nSensitive tables:");
      console.table(
        report.sensitiveTableAudit.map((t) => ({
          table: t.table,
          rls: t.rlsEnabled,
          policies: t.policyCount,
          anon_select: t.exposure.anon?.SELECT ?? "n/a",
          auth_select: t.exposure.authenticated?.SELECT ?? "n/a",
          public_grants: t.exposure.PUBLIC?.anyGrant ?? false,
        })),
      );
    }

    const blocked =
      report.summary.rlsDisabled === 0 &&
      report.summary.apiRoleExposures === 0 &&
      report.summary.publicRoleTableGrants === 0 &&
      !report.summary.unauthenticatedCanSelect &&
      !report.summary.unauthenticatedCanInsert &&
      !report.summary.unauthenticatedCanUpdate &&
      !report.summary.unauthenticatedCanDelete;

    if (!jsonOutput) {
      console.log(`\nVerdict: ${blocked ? "DEFAULT-DENY ENFORCED" : "EXPOSURE DETECTED"}`);
    }

    process.exit(blocked ? 0 : 1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
