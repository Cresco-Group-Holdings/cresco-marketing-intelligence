import { prisma } from "@/lib/database/prisma";

export const WAREHOUSE_STUB_TRANSFORMATION = {
  name: "warehouse-stub-normaliser",
  version: "2026-07-30.1",
} as const;

export const WAREHOUSE_STUB_SCHEMA_VERSION = "2026-07-30.1";

export async function ensureTransformationVersion() {
  return prisma.dataTransformationVersion.upsert({
    where: {
      name_version: {
        name: WAREHOUSE_STUB_TRANSFORMATION.name,
        version: WAREHOUSE_STUB_TRANSFORMATION.version,
      },
    },
    create: {
      name: WAREHOUSE_STUB_TRANSFORMATION.name,
      version: WAREHOUSE_STUB_TRANSFORMATION.version,
      description: "Stub normaliser for manual import and first-party records",
      definition: { adapter: "stub", providers: ["MANUAL_IMPORT", "FIRST_PARTY"] },
      isActive: true,
    },
    update: { isActive: true },
  });
}

export async function ensureRawSchemaVersion(marketingDataSourceId: string) {
  return prisma.rawMarketingSchemaVersion.upsert({
    where: {
      marketingDataSourceId_version: {
        marketingDataSourceId,
        version: WAREHOUSE_STUB_SCHEMA_VERSION,
      },
    },
    create: {
      marketingDataSourceId,
      version: WAREHOUSE_STUB_SCHEMA_VERSION,
      schemaDefinition: { adapter: "stub", fields: ["*"] },
      isActive: true,
    },
    update: { isActive: true },
  });
}
