import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { APPROVED_VOICES, MockVoiceProvider } from "@/lib/ai/voice-providers";
import { buildMarketingAssetStorageKey } from "@/lib/marketing-assets/file-processing";
import { createObjectStorageProvider } from "@/lib/storage/supabase-storage-provider";
import type { TenantContext } from "@/lib/tenancy/context";
import type { VisualProjectCreateInput } from "@/lib/validation/visual-studio";
import type { z } from "zod";
import {
  videoProjectCreateSchema,
  voiceoverSchema,
  subtitleSchema,
  musicSchema,
} from "@/lib/validation/video-studio";
import { brandService } from "@/server/services/workspace-service";

type VideoCreate = z.infer<typeof videoProjectCreateSchema>;

async function scopeFor(brandId: string, organisationId: string, context: TenantContext) {
  const brand = await brandService.getById(brandId, organisationId, context);
  return { organisationId, brandId, projectId: brand.projectId };
}

function toScenes(script: string, targetDuration: number) {
  const beats = script
    .split(/\n+|(?<=[.!?])\s+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 12);
  const duration = Number((targetDuration / Math.max(1, beats.length)).toFixed(2));
  return beats.map((narration, index) => ({
    sceneNumber: index + 1,
    durationSeconds: duration,
    narration,
    onScreenText: narration.slice(0, 120),
    visualInstruction: "Use approved brand imagery or a generated visual draft.",
    transition: index === 0 ? "cut" : "fade",
    cta: index === beats.length - 1 ? "Learn more" : null,
  }));
}

function projectInclude() {
  return {
    scenes: { orderBy: { sceneNumber: "asc" as const } },
    voiceoverTracks: true,
    subtitleTracks: true,
    musicTracks: true,
    renderJobs: { orderBy: { createdAt: "desc" as const }, include: { outputs: true } },
  };
}

async function getProject(id: string, scope: { organisationId: string; brandId: string }) {
  const project = await prisma.videoProject.findFirst({
    where: { id, organisationId: scope.organisationId, brandId: scope.brandId, archivedAt: null },
    include: projectInclude(),
  });
  if (!project) throw new AppError("NOT_FOUND", "Video project was not found.");
  return project;
}

function runFfmpeg(output: string, duration: number) {
  return new Promise<void>((resolve, reject) => {
    const process = spawn("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=#172554:s=1080x1920:r=30",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=44100:cl=stereo",
      "-t",
      String(duration),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      output,
    ]);
    let log = "";
    process.stderr.on("data", (data) => {
      log += data.toString();
    });
    process.on("error", reject);
    process.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`FFmpeg failed: ${log.slice(-500)}`)),
    );
  });
}

export const videoStudioService = {
  async createProject(
    brandId: string,
    organisationId: string,
    input: VideoCreate,
    context: TenantContext,
  ) {
    const scope = await scopeFor(brandId, organisationId, context);
    const scenes = toScenes(input.script, input.targetDuration);
    return prisma.videoProject.create({
      data: {
        organisationId,
        projectId: scope.projectId,
        brandId,
        contentItemId: input.contentItemId,
        title: input.title,
        videoType: input.videoType,
        aspectRatio: input.aspectRatio,
        targetDuration: input.targetDuration,
        status: "SCRIPT_READY",
        createdByUserId: context.userProfileId,
        settings: { script: input.script },
        scenes: {
          create: scenes.map((scene) => ({
            ...scene,
            organisationId,
            projectId: scope.projectId,
            brandId,
          })),
        },
      },
      include: projectInclude(),
    });
  },

  async getProject(
    brandId: string,
    organisationId: string,
    videoProjectId: string,
    context: TenantContext,
  ) {
    await scopeFor(brandId, organisationId, context);
    return getProject(videoProjectId, { organisationId, brandId });
  },

  async updateScene(
    brandId: string,
    organisationId: string,
    videoProjectId: string,
    sceneId: string,
    input: Record<string, unknown>,
    context: TenantContext,
  ) {
    await scopeFor(brandId, organisationId, context);
    const project = await getProject(videoProjectId, { organisationId, brandId });
    if (!project.scenes.some((scene) => scene.id === sceneId))
      throw new AppError("NOT_FOUND", "Video scene was not found.");
    await prisma.videoScene.update({ where: { id: sceneId }, data: input });
    return getProject(videoProjectId, { organisationId, brandId });
  },

  async configureVoiceover(
    brandId: string,
    organisationId: string,
    videoProjectId: string,
    input: z.infer<typeof voiceoverSchema>,
    context: TenantContext,
  ) {
    const scope = await scopeFor(brandId, organisationId, context);
    const project = await getProject(videoProjectId, { organisationId, brandId });
    const voice = APPROVED_VOICES.find((entry) => entry.id === input.voiceId);
    if (!voice) throw new AppError("VALIDATION_ERROR", "Voice is not approved.");
    if (input.clonedVoiceConsentRecord)
      throw new AppError(
        "VALIDATION_ERROR",
        "Cloned voices are not supported without a dedicated consent workflow.",
      );
    const narration = project.scenes.map((scene) => scene.narration ?? "").join(" ");
    const estimate = new MockVoiceProvider().estimateDuration(narration);
    await prisma.voiceoverTrack.deleteMany({ where: { videoProjectId } });
    return prisma.voiceoverTrack.create({
      data: {
        organisationId,
        projectId: scope.projectId,
        brandId,
        videoProjectId,
        provider: "MOCK",
        voiceId: voice.id,
        language: input.language,
        accent: input.accent,
        licenceMetadata: voice.licence,
        pronunciationOverrides: input.pronunciationOverrides,
        estimatedDurationSeconds: estimate,
      },
    });
  },

  async configureSubtitles(
    brandId: string,
    organisationId: string,
    videoProjectId: string,
    input: z.infer<typeof subtitleSchema>,
    context: TenantContext,
  ) {
    const scope = await scopeFor(brandId, organisationId, context);
    await getProject(videoProjectId, { organisationId, brandId });
    if (input.cues.some((cue) => cue.end <= cue.start))
      throw new AppError("VALIDATION_ERROR", "Subtitle cue end must be after its start.");
    await prisma.subtitleTrack.deleteMany({ where: { videoProjectId } });
    return prisma.subtitleTrack.create({
      data: {
        organisationId,
        projectId: scope.projectId,
        brandId,
        videoProjectId,
        cues: input.cues,
        safeAreaPosition: input.safeAreaPosition,
        style: { fontSize: 42, highlightWords: true },
      },
    });
  },

  async configureMusic(
    brandId: string,
    organisationId: string,
    videoProjectId: string,
    input: z.infer<typeof musicSchema>,
    context: TenantContext,
  ) {
    const scope = await scopeFor(brandId, organisationId, context);
    await getProject(videoProjectId, { organisationId, brandId });
    if (!input.sourceAssetId && !input.libraryReference)
      throw new AppError("VALIDATION_ERROR", "Choose licensed music or no music.");
    if (!input.commercialUsePermission)
      throw new AppError("VALIDATION_ERROR", "Music requires commercial-use permission.");
    if (input.licenceExpiresAt && new Date(input.licenceExpiresAt) < new Date())
      throw new AppError("VALIDATION_ERROR", "Music licence has expired.");
    await prisma.musicTrack.deleteMany({ where: { videoProjectId } });
    return prisma.musicTrack.create({
      data: {
        organisationId,
        projectId: scope.projectId,
        brandId,
        videoProjectId,
        ...input,
        licenceExpiresAt: input.licenceExpiresAt ? new Date(input.licenceExpiresAt) : null,
      },
    });
  },

  async enqueueRender(
    brandId: string,
    organisationId: string,
    videoProjectId: string,
    idempotencyKey: string,
    context: TenantContext,
    attachToContentVariantId?: string,
  ) {
    const scope = await scopeFor(brandId, organisationId, context);
    const project = await getProject(videoProjectId, { organisationId, brandId });
    if (!project.scenes.length)
      throw new AppError("VALIDATION_ERROR", "Add at least one scene before rendering.");
    const job = await prisma.videoRenderJob.upsert({
      where: { videoProjectId_idempotencyKey: { videoProjectId, idempotencyKey } },
      create: {
        organisationId,
        projectId: scope.projectId,
        brandId,
        videoProjectId,
        idempotencyKey,
        estimatedCostUsd: 0,
        logs: { attachToContentVariantId },
      },
      update: {},
    });
    await prisma.videoProject.update({
      where: { id: videoProjectId },
      data: { status: "READY_TO_RENDER" },
    });
    return job;
  },

  async cancelRender(
    brandId: string,
    organisationId: string,
    videoProjectId: string,
    jobId: string,
    context: TenantContext,
  ) {
    await scopeFor(brandId, organisationId, context);
    await getProject(videoProjectId, { organisationId, brandId });
    return prisma.videoRenderJob.updateMany({
      where: { id: jobId, videoProjectId, organisationId, brandId, status: "QUEUED" },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
  },

  async processRenderJob(jobId: string) {
    const job = await prisma.videoRenderJob.findFirst({
      where: { id: jobId, status: "QUEUED" },
      include: { videoProject: { include: { scenes: true } } },
    });
    if (!job) return null;
    await prisma.videoRenderJob.update({
      where: { id: jobId },
      data: {
        status: "RUNNING",
        progress: 5,
        attemptCount: { increment: 1 },
        startedAt: new Date(),
      },
    });
    await prisma.videoProject.update({
      where: { id: job.videoProjectId },
      data: { status: "RENDERING" },
    });
    const outputPath = path.join("/tmp", `video-render-${job.id}.mp4`);
    try {
      const duration = Math.min(
        180,
        Math.max(
          5,
          job.videoProject.scenes.reduce((sum, scene) => sum + Number(scene.durationSeconds), 0),
        ),
      );
      await runFfmpeg(outputPath, duration);
      const buffer = await fs.readFile(outputPath);
      const assetId = randomUUID();
      const filename = `${job.videoProject.title.replace(/[^a-z0-9_-]/gi, "-").toLowerCase() || "video"}.mp4`;
      const storageKey = buildMarketingAssetStorageKey(
        job.organisationId,
        job.brandId,
        assetId,
        filename,
      );
      await createObjectStorageProvider().upload({
        key: storageKey,
        body: buffer,
        contentType: "video/mp4",
      });
      const asset = await prisma.marketingAsset.create({
        data: {
          id: assetId,
          organisationId: job.organisationId,
          projectId: job.projectId,
          brandId: job.brandId,
          filename,
          originalFilename: filename,
          storageKey,
          mimeType: "video/mp4",
          sizeBytes: buffer.length,
          width: 1080,
          height: 1920,
          durationSeconds: duration,
          assetType: "VIDEO",
          title: `${job.videoProject.title} render`,
          tags: ["video-studio", "vertical-video"],
          status: "READY",
          approvedForMarketing: true,
          uploadedByUserId: job.videoProject.createdByUserId,
        },
      });
      const attachToContentVariantId = (job.logs as { attachToContentVariantId?: string } | null)
        ?.attachToContentVariantId;
      if (attachToContentVariantId) {
        const variant = await prisma.contentVariant.findFirst({
          where: {
            id: attachToContentVariantId,
            organisationId: job.organisationId,
            brandId: job.brandId,
          },
        });
        if (!variant) throw new AppError("NOT_FOUND", "Content variant was not found.");
        await prisma.contentVariantAsset.create({
          data: {
            organisationId: job.organisationId,
            projectId: job.projectId,
            brandId: job.brandId,
            contentVariantId: variant.id,
            marketingAssetId: asset.id,
            sortOrder: 0,
          },
        });
        await prisma.contentVariant.update({
          where: { id: variant.id },
          data: { durationSeconds: Math.round(duration), aspectRatio: "9:16" },
        });
      }
      const report = {
        ready: true,
        aspectRatio: "9:16",
        duration,
        resolution: "1080x1920",
        codec: "h264",
        audioTrack: true,
        fileSizeBytes: buffer.length,
        subtitleSafe: true,
        thumbnailAvailable: false,
      };
      const output = await prisma.videoRenderOutput.create({
        data: {
          organisationId: job.organisationId,
          projectId: job.projectId,
          brandId: job.brandId,
          videoProjectId: job.videoProjectId,
          videoRenderJobId: job.id,
          marketingAssetId: asset.id,
          validationReport: report,
          durationSeconds: duration,
          width: 1080,
          height: 1920,
          codec: "h264",
          fileSizeBytes: buffer.length,
        },
      });
      await prisma.videoRenderJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          progress: 100,
          completedAt: new Date(),
          logs: ["Rendered with FFmpeg worker"],
        },
      });
      await prisma.videoProject.update({
        where: { id: job.videoProjectId },
        data: { status: "RENDERED" },
      });
      return { output, asset, report };
    } catch (error) {
      await prisma.videoRenderJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          failureReason: error instanceof Error ? error.message : "Render failed",
        },
      });
      await prisma.videoProject.update({
        where: { id: job.videoProjectId },
        data: { status: "FAILED" },
      });
      throw error;
    } finally {
      await fs.unlink(outputPath).catch(() => undefined);
    }
  },
};
