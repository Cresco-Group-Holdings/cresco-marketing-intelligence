#!/usr/bin/env node

/**
 * Audits public schema function privileges for the RLS hardening report.
 * Requires ANALYTICS_TEST_DATABASE_URL or DIRECT_URL.
 */

import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.ANALYTICS_TEST_DATABASE_URL ?? process.env.DIRECT_URL;

if (!databaseUrl) {
  console.error("Set ANALYTICS_TEST_DATABASE_URL or DIRECT_URL.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

try {
  const functions = await prisma.$queryRaw`
    SELECT
      p.proname AS name,
      pg_get_function_identity_arguments(p.oid) AS args,
      pg_get_userbyid(p.proowner) AS owner,
      p.prosecdef AS security_definer,
      COALESCE(array_to_string(p.proconfig, ', '), '') AS config
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
    ORDER BY p.proname
  `;

  const publicExecute = await prisma.$queryRaw`
    SELECT
      p.proname AS name,
      pg_get_function_identity_arguments(p.oid) AS args,
      has_function_privilege('PUBLIC', p.oid, 'EXECUTE') AS public_execute
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
    ORDER BY p.proname
  `;

  const securityDefiner = functions.filter((f) => f.security_definer === true);

  console.log(JSON.stringify({
    publicFunctionCount: functions.length,
    securityDefinerCount: securityDefiner.length,
    securityDefinerFunctions: securityDefiner,
    publicExecuteGrants: publicExecute.filter((f) => f.public_execute === true),
    allFunctions: functions,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
