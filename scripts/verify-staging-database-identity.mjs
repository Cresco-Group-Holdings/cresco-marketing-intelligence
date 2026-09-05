#!/usr/bin/env node

/**
 * Prints safe staging database metadata and aborts if identity cannot be verified.
 * Never prints passwords or full connection strings.
 */

import { PrismaClient } from "@prisma/client";

const databaseUrl =
  process.env.STAGING_DIRECT_URL ??
  process.env.STAGING_CERTIFICATION_DATABASE_URL ??
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL;

const expectedProjectRef = process.env.STAGING_SUPABASE_PROJECT_REF?.trim();
const forbiddenProjectRef = process.env.PRODUCTION_SUPABASE_PROJECT_REF?.trim();
const expectedProjectName = "cresco-marketing-intelligence-staging";

function parseSafeMetadata(url) {
  const parsed = new URL(url);
  const host = parsed.hostname;
  const database = parsed.pathname.replace(/^\//, "") || "(default)";
  const port = parsed.port || "5432";
  const refMatch =
    host.match(/db\.([a-z0-9]+)\.supabase\.co/i) ??
    host.match(/^([a-z0-9]{15,})\.supabase\.co/i);
  const projectRef = refMatch?.[1] ?? null;
  return { host, port, database, projectRef, isLocalhost: ["localhost", "127.0.0.1"].includes(host) };
}

async function main() {
  if (!databaseUrl) {
    console.error("STAGING_DIRECT_URL (or DIRECT_URL) is not configured.");
    process.exit(1);
  }

  const meta = parseSafeMetadata(databaseUrl);

  if (meta.isLocalhost) {
    console.error("Refusing to run: database host is localhost (not isolated staging Supabase).");
    process.exit(1);
  }

  if (!meta.host.includes("supabase")) {
    console.error(`Refusing to run: host '${meta.host}' is not a Supabase host.`);
    process.exit(1);
  }

  if (forbiddenProjectRef && meta.projectRef === forbiddenProjectRef) {
    console.error(
      "Refusing to run: database project ref matches configured PRODUCTION_SUPABASE_PROJECT_REF.",
    );
    process.exit(1);
  }

  if (expectedProjectRef && meta.projectRef !== expectedProjectRef) {
    console.error(
      `Refusing to run: expected staging project ref '${expectedProjectRef}' but host resolves to '${meta.projectRef ?? "unknown"}'.`,
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    const versionRows = await prisma.$queryRaw`SELECT version()`;
    const postgresVersion = String(Object.values(versionRows[0] ?? {})[0] ?? "unknown");

    const tableCountRows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;

    const migrationCountRows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count FROM "_prisma_migrations"
    `;

    let organisationCount = null;
    const orgTable = await prisma.$queryRaw`
      SELECT 1 AS ok
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'Organisation'
      LIMIT 1
    `;
    if (orgTable.length > 0) {
      const orgRows = await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "Organisation"`;
      organisationCount = Number(orgRows[0]?.count ?? 0);
    }

    const report = {
      expectedProjectName,
      host: meta.host,
      port: meta.port,
      database: meta.database,
      supabaseProjectRef: meta.projectRef,
      postgresVersion: postgresVersion.split(" ")[0],
      publicTableCount: Number(tableCountRows[0]?.count ?? 0),
      prismaMigrationRows: Number(migrationCountRows[0]?.count ?? 0),
      organisationCount,
      appearsEmpty: organisationCount === null || organisationCount === 0,
    };

    console.log(JSON.stringify(report, null, 2));

    if (organisationCount !== null && organisationCount > 0) {
      console.error(
        "Warning: Organisation table has rows. Verify this is not production customer data before migrating.",
      );
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
