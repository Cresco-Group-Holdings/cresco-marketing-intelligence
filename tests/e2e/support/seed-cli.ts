import { seedE2eTenants, disconnectE2eDatabase } from "./factories/tenant-factory";

async function main() {
  const manifest = await seedE2eTenants();
  await disconnectE2eDatabase();
  console.log(
    JSON.stringify(
      {
        ok: true,
        defaultAuthUserId: manifest.defaultAuthUserId,
        tenantAOrganisationId: manifest.tenantA.organisationId,
        tenantBOrganisationId: manifest.tenantB.organisationId,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
