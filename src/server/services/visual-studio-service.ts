import { randomUUID } from "node:crypto";
import path from "node:path";
import * as archiver from "archiver";
import PDFDocument from "pdfkit";
import { loadSharp } from "@/lib/images/sharp-loader";
import { Prisma, type VisualOutputType } from "@prisma/client";
import { getImageGenerationProvider } from "@/lib/ai/image-providers";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { buildMarketingAssetStorageKey } from "@/lib/marketing-assets/file-processing";
import { createObjectStorageProvider } from "@/lib/storage/supabase-storage-provider";
import type { TenantContext } from "@/lib/tenancy/context";
import type {
  VisualExportCreateInput,
  VisualProjectCreateInput,
} from "@/lib/validation/visual-studio";
import { brandService } from "@/server/services/workspace-service";

const DIMENSIONS: Record<VisualOutputType, { width: number; height: number }> = {
  SQUARE_POST: { width: 1080, height: 1080 },
  PORTRAIT_POST: { width: 1080, height: 1350 },
  LANDSCAPE_POST: { width: 1200, height: 628 },
  INSTAGRAM_CAROUSEL: { width: 1080, height: 1350 },
  LINKEDIN_CAROUSEL: { width: 1080, height: 1350 },
  REEL_COVER: { width: 1080, height: 1920 },
  TIKTOK_COVER: { width: 1080, height: 1920 },
  YOUTUBE_THUMBNAIL: { width: 1280, height: 720 },
  STORY_GRAPHIC: { width: 1080, height: 1920 },
  QUOTE_CARD: { width: 1080, height: 1080 },
  SIMPLE_INFOGRAPHIC: { width: 1080, height: 1350 },
};

function escapeXml(value: string): string {
  return value.replace(
    /[<>&"']/g,
    (character) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&quot;", '"': "&quot;", "'": "&apos;" })[character]!,
  );
}

async function scopeFor(brandId: string, organisationId: string, context: TenantContext) {
  const brand = await brandService.getById(brandId, organisationId, context);
  return { organisationId, projectId: brand.projectId, brandId, brand };
}

function visualInclude() {
  return {
    pages: {
      include: { elements: { orderBy: { sortOrder: "asc" as const } } },
      orderBy: { pageNumber: "asc" as const },
    },
    exports: { orderBy: { createdAt: "desc" as const } },
    template: { include: { activeVersion: true } },
  };
}

async function projectForScope(id: string, scope: { organisationId: string; brandId: string }) {
  const project = await prisma.visualProject.findFirst({
    where: { id, organisationId: scope.organisationId, brandId: scope.brandId, archivedAt: null },
    include: visualInclude(),
  });
  if (!project) throw new AppError("NOT_FOUND", "Visual project was not found.");
  return project;
}

async function ensureDefaultTemplates() {
  const defaults: Array<{ name: string; outputType: VisualOutputType }> = [
    { name: "Branded social post", outputType: "SQUARE_POST" },
    { name: "Instagram carousel", outputType: "INSTAGRAM_CAROUSEL" },
    { name: "LinkedIn carousel", outputType: "LINKEDIN_CAROUSEL" },
    { name: "Short-video cover", outputType: "REEL_COVER" },
    { name: "YouTube thumbnail", outputType: "YOUTUBE_THUMBNAIL" },
  ];
  for (const definition of defaults) {
    const existing = await prisma.visualTemplate.findFirst({
      where: {
        name: definition.name,
        organisationId: null,
        brandId: null,
        archivedAt: null,
      },
    });
    if (existing) continue;
    const dimensions = DIMENSIONS[definition.outputType];
    const template = await prisma.visualTemplate.create({
      data: {
        name: definition.name,
        outputType: definition.outputType,
        description: "System visual template",
        versions: {
          create: {
            version: 1,
            canvasWidth: dimensions.width,
            canvasHeight: dimensions.height,
            layout: {
              safeMargin: Math.round(dimensions.width * 0.06),
              elements: ["BACKGROUND", "TEXT", "LOGO"],
            },
          },
        },
      },
      include: { versions: true },
    });
    await prisma.visualTemplate.update({
      where: { id: template.id },
      data: { activeVersionId: template.versions[0]!.id },
    });
  }
}

function accessibilityWarnings(
  elements: Array<{ elementType: string; properties: unknown }>,
  width: number,
  height: number,
) {
  const warnings: string[] = [];
  for (const element of elements) {
    const properties = element.properties as Record<string, unknown>;
    if (
      element.elementType === "TEXT" &&
      Number(properties.fontSize ?? 0) < Math.max(18, width / 45)
    ) {
      warnings.push("Text may be below the recommended minimum size.");
    }
    if (typeof properties.text === "string" && properties.text.length > 240) {
      warnings.push("Text may overflow its visual area.");
    }
  }
  if (width === height && height < 1000)
    warnings.push("Canvas may not meet platform export dimensions.");
  return warnings;
}

async function renderPage(
  page: { background: unknown; elements: Array<{ elementType: string; properties: unknown }> },
  dimensions: { width: number; height: number },
  format: "png" | "jpeg" | "webp",
) {
  const background = (page.background as { colour?: string } | null)?.colour ?? "#172554";
  const textElements = page.elements.filter((element) => element.elementType === "TEXT");
  const svg = `<svg width="${dimensions.width}" height="${dimensions.height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${background}"/>${textElements
    .map((element) => {
      const p = element.properties as {
        text?: string;
        x?: number;
        y?: number;
        fontSize?: number;
        colour?: string;
      };
      return `<text x="${p.x ?? 80}" y="${p.y ?? 160}" fill="${p.colour ?? "#fff"}" font-family="Arial, sans-serif" font-size="${p.fontSize ?? 48}" font-weight="700">${escapeXml(p.text ?? "")}</text>`;
    })
    .join("")}</svg>`;
  const renderer = (await loadSharp())(Buffer.from(svg));
  if (format === "jpeg") return renderer.jpeg().toBuffer();
  if (format === "webp") return renderer.webp().toBuffer();
  return renderer.png().toBuffer();
}

async function createZip(files: Array<{ name: string; data: Buffer }>) {
  return new Promise<Buffer>((resolve, reject) => {
    const archive = new archiver.ZipArchive({ zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    for (const file of files) archive.append(file.data, { name: file.name });
    void archive.finalize();
  });
}

export const visualStudioService = {
  async listTemplates(brandId: string, organisationId: string, context: TenantContext) {
    await scopeFor(brandId, organisationId, context);
    await ensureDefaultTemplates();
    return prisma.visualTemplate.findMany({
      where: { archivedAt: null, OR: [{ organisationId: null }, { organisationId }, { brandId }] },
      include: { activeVersion: true },
      orderBy: { updatedAt: "desc" },
    });
  },

  async createProject(
    brandId: string,
    organisationId: string,
    input: VisualProjectCreateInput,
    context: TenantContext,
  ) {
    const scope = await scopeFor(brandId, organisationId, context);
    const dimensions = DIMENSIONS[input.outputType];
    const template = input.templateId
      ? await prisma.visualTemplate.findFirst({
          where: {
            id: input.templateId,
            OR: [{ organisationId: null }, { organisationId }, { brandId }],
          },
          include: { activeVersion: true },
        })
      : null;
    if (input.templateId && !template)
      throw new AppError("NOT_FOUND", "Visual template was not found.");

    return prisma.visualProject.create({
      data: {
        organisationId,
        projectId: scope.projectId,
        brandId,
        templateId: template?.id,
        templateVersionId: template?.activeVersion?.id,
        title: input.title,
        outputType: input.outputType,
        sourceContentId: input.sourceContentId,
        createdByUserId: context.userProfileId,
        settings: {
          ...input.brandLocks,
          dimensions,
          brandColours: [
            scope.brand.primaryColour,
            scope.brand.secondaryColour,
            scope.brand.accentColour,
          ].filter(Boolean),
          logoUrl: scope.brand.logoUrl,
        },
        pages: {
          create: input.outline.map((text, index) => ({
            organisationId,
            projectId: scope.projectId,
            brandId,
            pageNumber: index + 1,
            title: `Slide ${index + 1}`,
            background: { colour: scope.brand.primaryColour ?? "#172554" },
            elements: {
              create: [
                {
                  organisationId,
                  projectId: scope.projectId,
                  brandId,
                  elementType: "TEXT",
                  sortOrder: 1,
                  locked: false,
                  properties: {
                    text,
                    x: 80,
                    y: 160,
                    width: dimensions.width - 160,
                    fontSize: Math.round(dimensions.width / 16),
                    colour: "#ffffff",
                  },
                },
                ...(scope.brand.logoUrl
                  ? [
                      {
                        organisationId,
                        projectId: scope.projectId,
                        brandId,
                        elementType: "LOGO" as const,
                        sortOrder: 2,
                        locked: input.brandLocks.logoPosition,
                        properties: {
                          url: scope.brand.logoUrl,
                          x: 80,
                          y: dimensions.height - 120,
                          width: 160,
                        },
                      },
                    ]
                  : []),
                ...(input.brandLocks.footer
                  ? [
                      {
                        organisationId,
                        projectId: scope.projectId,
                        brandId,
                        elementType: "TEXT" as const,
                        sortOrder: 3,
                        locked: true,
                        properties: {
                          text: input.brandLocks.footer,
                          x: 80,
                          y: dimensions.height - 60,
                          width: dimensions.width - 160,
                          fontSize: 22,
                          colour: "#ffffff",
                        },
                      },
                    ]
                  : []),
              ],
            },
          })),
        },
      },
      include: visualInclude(),
    });
  },

  async getProject(
    brandId: string,
    organisationId: string,
    projectId: string,
    context: TenantContext,
  ) {
    await scopeFor(brandId, organisationId, context);
    return projectForScope(projectId, { organisationId, brandId });
  },

  async reorderPages(
    brandId: string,
    organisationId: string,
    projectId: string,
    pageIds: string[],
    context: TenantContext,
  ) {
    await scopeFor(brandId, organisationId, context);
    const project = await projectForScope(projectId, { organisationId, brandId });
    if (
      pageIds.length !== project.pages.length ||
      pageIds.some((id) => !project.pages.some((page) => page.id === id))
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Page order must contain every project page exactly once.",
      );
    }
    await prisma.$transaction(
      pageIds.map((id, index) =>
        prisma.visualPage.update({ where: { id }, data: { pageNumber: index + 1 } }),
      ),
    );
    return projectForScope(projectId, { organisationId, brandId });
  },

  async updateElement(
    brandId: string,
    organisationId: string,
    projectId: string,
    elementId: string,
    input: { properties?: Record<string, unknown>; locked?: boolean },
    context: TenantContext,
  ) {
    await scopeFor(brandId, organisationId, context);
    const project = await projectForScope(projectId, { organisationId, brandId });
    const element = project.pages
      .flatMap((page) => page.elements)
      .find((item) => item.id === elementId);
    if (!element) throw new AppError("NOT_FOUND", "Visual element was not found.");
    if (element.locked && input.properties)
      throw new AppError("FORBIDDEN", "This brand-controlled element is locked.");
    await prisma.visualElement.update({
      where: { id: elementId },
      data: {
        properties: input.properties as Prisma.InputJsonValue | undefined,
        locked: input.locked,
      },
    });
    return projectForScope(projectId, { organisationId, brandId });
  },

  async generateImage(
    brandId: string,
    organisationId: string,
    projectId: string,
    input: {
      prompt: string;
      sourceAssetId?: string;
      provider: "MOCK";
      model: string;
      commercialUseConfirmed: boolean;
    },
    context: TenantContext,
  ) {
    const scope = await scopeFor(brandId, organisationId, context);
    const project = await projectForScope(projectId, { organisationId, brandId });
    if (!input.commercialUseConfirmed)
      throw new AppError("VALIDATION_ERROR", "Commercial-use confirmation is required.");
    if (input.sourceAssetId) {
      const asset = await prisma.marketingAsset.findFirst({
        where: {
          id: input.sourceAssetId,
          organisationId,
          brandId,
          status: "READY",
          approvedForMarketing: true,
          archivedAt: null,
        },
      });
      if (
        !asset ||
        (asset.licenceExpiresAt && asset.licenceExpiresAt < new Date()) ||
        !asset.consentNotes
      ) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Source asset is not approved, licensed, or consented for visual generation.",
        );
      }
    }
    const dimensions = DIMENSIONS[project.outputType];
    const generated = await getImageGenerationProvider(input.provider).generate({
      prompt: input.prompt,
      width: dimensions.width,
      height: dimensions.height,
      model: input.model,
    });
    await prisma.visualGeneration.create({
      data: {
        organisationId,
        projectId: scope.projectId,
        brandId,
        visualProjectId: project.id,
        sourceAssetId: input.sourceAssetId,
        provider: generated.provider,
        model: generated.model,
        promptVersion: "visual-image-v1",
        parameters: { width: dimensions.width, height: dimensions.height },
        moderation: generated.moderation,
        estimatedCostUsd: generated.estimatedCostUsd,
        commercialUseMetadata: generated.commercialUseMetadata,
      },
    });
    return { ...generated, buffer: undefined };
  },

  async exportProject(
    brandId: string,
    organisationId: string,
    visualProjectId: string,
    input: VisualExportCreateInput,
    context: TenantContext,
  ) {
    const scope = await scopeFor(brandId, organisationId, context);
    const project = await projectForScope(visualProjectId, { organisationId, brandId });
    const dimensions = DIMENSIONS[project.outputType];
    const page = project.pages[0];
    if (!page) throw new AppError("VALIDATION_ERROR", "A visual project needs at least one page.");
    const format = input.format === "JPG" ? "jpeg" : (input.format.toLowerCase() as "png" | "webp");
    let buffer: Buffer;
    let mimeType: string;
    if (input.format === "PDF") {
      buffer = await new Promise<Buffer>((resolve, reject) => {
        const document = new PDFDocument({ autoFirstPage: false });
        const chunks: Buffer[] = [];
        document.on("data", (chunk: Buffer) => chunks.push(chunk));
        document.on("end", () => resolve(Buffer.concat(chunks)));
        document.on("error", reject);
        for (const projectPage of project.pages) {
          document.addPage({ size: [dimensions.width, dimensions.height], margin: 0 });
          const background =
            (projectPage.background as { colour?: string } | null)?.colour ?? "#172554";
          document.rect(0, 0, dimensions.width, dimensions.height).fill(background);
          for (const element of projectPage.elements.filter(
            (item) => item.elementType === "TEXT",
          )) {
            const p = element.properties as {
              text?: string;
              x?: number;
              y?: number;
              width?: number;
              fontSize?: number;
              colour?: string;
            };
            document
              .fillColor(p.colour ?? "#ffffff")
              .fontSize(p.fontSize ?? 48)
              .text(p.text ?? "", p.x ?? 80, p.y ?? 120, {
                width: p.width ?? dimensions.width - 160,
              });
          }
        }
        document.end();
      });
      mimeType = "application/pdf";
    } else if (input.format === "ZIP") {
      const rendered = await Promise.all(
        project.pages.map((projectPage) => renderPage(projectPage, dimensions, "png")),
      );
      buffer = await createZip(
        rendered.map((data, index) => ({ name: `slide-${index + 1}.png`, data })),
      );
      mimeType = "application/zip";
    } else {
      buffer = await renderPage(page, dimensions, format);
      mimeType = input.format === "JPG" ? "image/jpeg" : `image/${format}`;
    }
    const extension = input.format === "JPG" ? "jpg" : input.format.toLowerCase();
    const assetId = randomUUID();
    const filename = `${
      path
        .basename(project.title)
        .replace(/[^a-z0-9_-]/gi, "-")
        .toLowerCase() || "visual"
    }-${page.pageNumber}.${extension}`;
    const storageKey = buildMarketingAssetStorageKey(organisationId, brandId, assetId, filename);
    const exportRecord = await prisma.visualExport.create({
      data: {
        organisationId,
        projectId: scope.projectId,
        brandId,
        visualProjectId,
        format: input.format,
      },
    });
    try {
      await createObjectStorageProvider().upload({
        key: storageKey,
        body: buffer,
        contentType: mimeType,
      });
      const asset = await prisma.marketingAsset.create({
        data: {
          id: assetId,
          organisationId,
          projectId: scope.projectId,
          brandId,
          filename,
          originalFilename: filename,
          storageKey,
          mimeType,
          sizeBytes: buffer.length,
          width: input.format === "PDF" || input.format === "ZIP" ? null : dimensions.width,
          height: input.format === "PDF" || input.format === "ZIP" ? null : dimensions.height,
          assetType: input.format === "PDF" || input.format === "ZIP" ? "DOCUMENT" : "IMAGE",
          title: `${project.title} export`,
          tags: ["visual-studio", project.outputType.toLowerCase()],
          status: "READY",
          approvedForMarketing: true,
          uploadedByUserId: context.userProfileId,
        },
      });
      if (input.attachToContentVariantId) {
        if (input.format === "PDF" || input.format === "ZIP")
          throw new AppError(
            "VALIDATION_ERROR",
            "Only image exports can attach to a content variant.",
          );
        const variant = await prisma.contentVariant.findFirst({
          where: { id: input.attachToContentVariantId, organisationId, brandId },
        });
        if (!variant) throw new AppError("NOT_FOUND", "Content variant was not found.");
        await prisma.contentVariantAsset.create({
          data: {
            organisationId,
            projectId: scope.projectId,
            brandId,
            contentVariantId: variant.id,
            marketingAssetId: asset.id,
            sortOrder: 0,
            altText: input.altText || null,
          },
        });
      }
      const warnings = accessibilityWarnings(page.elements, dimensions.width, dimensions.height);
      await prisma.visualExport.update({
        where: { id: exportRecord.id },
        data: {
          status: "COMPLETED",
          marketingAssetId: asset.id,
          metadata: { warnings, altText: input.altText || null },
          completedAt: new Date(),
        },
      });
      await prisma.visualProject.update({
        where: { id: visualProjectId },
        data: { status: "EXPORTED" },
      });
      return {
        export: await prisma.visualExport.findUniqueOrThrow({ where: { id: exportRecord.id } }),
        asset,
        warnings,
      };
    } catch (error) {
      await prisma.visualExport.update({
        where: { id: exportRecord.id },
        data: {
          status: "FAILED",
          failureReason: error instanceof Error ? error.message : "Export failed",
        },
      });
      throw error;
    }
  },
};
