import type { AttributionModelType, DirectTrafficPolicy, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { DEFAULT_LOOKBACK_WINDOW_DAYS, DEFAULT_MODEL_CONFIGS } from "@/lib/attribution/constants";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const attributionModelService = {
  async ensureDefaultModels(brandId: string, organisationId: string, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const existing = await prisma.attributionModel.count({ where: { brandId, organisationId } });
    if (existing > 0) return;

    const modelTypes = Object.entries(DEFAULT_MODEL_CONFIGS) as Array<
      [AttributionModelType, { name: string; isDefault?: boolean }]
    >;

    for (const [modelType, config] of modelTypes) {
      await this.createModel(
        brandId,
        organisationId,
        {
          name: config.name,
          modelType,
          isDefault: config.isDefault ?? false,
          lookbackWindowDays: DEFAULT_LOOKBACK_WINDOW_DAYS,
          directTrafficPolicy: "RETAIN",
        },
        context,
        brand.projectId,
      );
    }
  },

  async listModels(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    await this.ensureDefaultModels(brandId, organisationId, context);

    return prisma.attributionModel.findMany({
      where: { brandId, organisationId, isActive: true },
      include: {
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  },

  async getModel(brandId: string, organisationId: string, modelId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const model = await prisma.attributionModel.findFirst({
      where: { id: modelId, brandId, organisationId },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    });
    if (!model) throw new AppError("NOT_FOUND", "Attribution model was not found.");
    return model;
  },

  async createModel(
    brandId: string,
    organisationId: string,
    input: {
      name: string;
      modelType: AttributionModelType;
      directTrafficPolicy?: DirectTrafficPolicy;
      lookbackWindowDays?: number;
      isDefault?: boolean;
      config?: Prisma.InputJsonValue;
    },
    context: TenantContext,
    projectId?: string,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const resolvedProjectId = projectId ?? brand.projectId;

    if (input.isDefault) {
      await prisma.attributionModel.updateMany({
        where: { brandId, organisationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.$transaction(async (tx) => {
      const model = await tx.attributionModel.create({
        data: {
          organisationId,
          projectId: resolvedProjectId,
          brandId,
          name: input.name,
          modelType: input.modelType,
          directTrafficPolicy: input.directTrafficPolicy ?? "RETAIN",
          lookbackWindowDays: input.lookbackWindowDays ?? DEFAULT_LOOKBACK_WINDOW_DAYS,
          isDefault: input.isDefault ?? false,
          config: input.config ?? undefined,
        },
      });

      const version = await tx.attributionModelVersion.create({
        data: {
          organisationId,
          projectId: resolvedProjectId,
          brandId,
          attributionModelId: model.id,
          versionNumber: 1,
          modelType: model.modelType,
          directTrafficPolicy: model.directTrafficPolicy,
          lookbackWindowDays: model.lookbackWindowDays,
          config: model.config ?? undefined,
          changelog: "Initial version",
          createdByUserId: context.userProfileId,
        },
      });

      await tx.attributionModel.update({
        where: { id: model.id },
        data: { currentVersionId: version.id },
      });

      return { ...model, currentVersionId: version.id, versions: [version] };
    });
  },

  async createVersion(
    brandId: string,
    organisationId: string,
    modelId: string,
    input: {
      directTrafficPolicy?: DirectTrafficPolicy;
      lookbackWindowDays?: number;
      config?: Prisma.InputJsonValue;
      changelog?: string;
    },
    context: TenantContext,
  ) {
    const model = await this.getModel(brandId, organisationId, modelId, context);
    const latestVersion = model.versions[0]?.versionNumber ?? 0;

    const version = await prisma.$transaction(async (tx) => {
      const created = await tx.attributionModelVersion.create({
        data: {
          organisationId,
          projectId: model.projectId,
          brandId,
          attributionModelId: model.id,
          versionNumber: latestVersion + 1,
          modelType: model.modelType,
          directTrafficPolicy: input.directTrafficPolicy ?? model.directTrafficPolicy,
          lookbackWindowDays: input.lookbackWindowDays ?? model.lookbackWindowDays,
          config: input.config ?? model.config ?? undefined,
          changelog: input.changelog ?? "Configuration update",
          createdByUserId: context.userProfileId,
        },
      });

      await tx.attributionModel.update({
        where: { id: model.id },
        data: {
          directTrafficPolicy: input.directTrafficPolicy ?? model.directTrafficPolicy,
          lookbackWindowDays: input.lookbackWindowDays ?? model.lookbackWindowDays,
          config: input.config ?? model.config ?? undefined,
          currentVersionId: created.id,
        },
      });

      return created;
    });

    return version;
  },
};
