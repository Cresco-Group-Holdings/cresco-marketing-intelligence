import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";

const DEFAULT_TEMPLATES = [
  {
    key: "diagnostics.ping",
    name: "Diagnostics Ping",
    description: "Harmless connectivity test for AI diagnostics.",
    purpose: "DIAGNOSTICS_TEST" as const,
    systemPrompt:
      "You are a diagnostics assistant. Respond briefly and safely. Never request secrets or credentials.",
    outputSchemaKey: "diagnostics.ping",
  },
  {
    key: "diagnostics.structured",
    name: "Diagnostics Structured Output",
    description: "Validates structured JSON responses.",
    purpose: "DIAGNOSTICS_TEST" as const,
    systemPrompt:
      "You are a diagnostics assistant. Return concise JSON only. Never include secrets.",
    outputSchemaKey: "diagnostics.structured",
  },
] as const;

export const promptTemplateService = {
  async ensureDefaults(): Promise<void> {
    for (const template of DEFAULT_TEMPLATES) {
      const existing = await prisma.promptTemplate.findUnique({ where: { key: template.key } });
      if (existing) continue;

      const created = await prisma.promptTemplate.create({
        data: {
          key: template.key,
          name: template.name,
          description: template.description,
          purpose: template.purpose,
          versions: {
            create: {
              version: 1,
              systemPrompt: template.systemPrompt,
              outputSchemaKey: template.outputSchemaKey,
              status: "ACTIVE",
            },
          },
        },
        include: { versions: true },
      });

      const activeVersion = created.versions[0];
      if (activeVersion) {
        await prisma.promptTemplate.update({
          where: { id: created.id },
          data: { activeVersionId: activeVersion.id },
        });
      }
    }
  },

  async getActiveTemplate(key: string) {
    await this.ensureDefaults();
    const template = await prisma.promptTemplate.findUnique({
      where: { key },
      include: { activeVersion: true },
    });

    if (!template?.activeVersion) {
      throw new AppError("NOT_FOUND", "Prompt template was not found.");
    }

    return template;
  },
};
