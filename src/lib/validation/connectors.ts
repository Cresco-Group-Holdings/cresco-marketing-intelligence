import { z } from "zod";
import { ConnectorType } from "@prisma/client";

export const connectorTypeSchema = z.nativeEnum(ConnectorType);

export const beginConnectorSchema = z.object({
  connectorType: connectorTypeSchema,
});

export const completeConnectorOAuthSchema = z.object({
  connectorType: connectorTypeSchema,
  state: z.string().min(1),
  code: z.string().min(1),
});

export const connectorSyncSchema = z.object({
  syncType: z.enum(["INITIAL", "INCREMENTAL"]).default("INCREMENTAL"),
  idempotencyKey: z.string().min(1).optional(),
});
