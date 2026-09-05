import { execSync } from "node:child_process";
import { disconnectE2eDatabase, seedE2eTenants } from "./factories/tenant-factory";

export default async function globalSetup() {
  if (process.env.CRESCO_E2E_SKIP_DB_SETUP === "true") {
    return;
  }

  const databaseUrl = process.env.DATABASE_URL ?? process.env.ANALYTICS_TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL (or ANALYTICS_TEST_DATABASE_URL) is required for launch E2E.");
  }

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: process.env,
  });

  execSync("npx prisma generate", {
    stdio: "inherit",
    env: process.env,
  });

  const manifest = await seedE2eTenants();
  await disconnectE2eDatabase();

  process.env.TEST_AUTH_USER_ID = manifest.defaultAuthUserId;
  process.env.TEST_AUTH_EMAIL = manifest.tenantA.users.owner.email;
  process.env.E2E_DEFAULT_AUTH_USER_ID = manifest.defaultAuthUserId;
}
