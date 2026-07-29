import { describe, expect, it } from "vitest";
import { MockImageGenerationProvider } from "@/lib/ai/image-providers";
import { visualAiImageSchema, visualProjectCreateSchema } from "@/lib/validation/visual-studio";

describe("visual studio validation", () => {
  it("requires an outline and locked brand controls", () => {
    const result = visualProjectCreateSchema.safeParse({
      title: "Campaign carousel",
      outputType: "INSTAGRAM_CAROUSEL",
      outline: ["Hook", "Problem", "CTA"],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.brandLocks.brandColours).toBe(true);
  });

  it("requires commercial use confirmation for image generation", () => {
    expect(
      visualAiImageSchema.safeParse({
        prompt: "A branded illustration",
        commercialUseConfirmed: false,
      }).success,
    ).toBe(true);
  });

  it("returns a moderated image generation result without provider credentials", async () => {
    const result = await new MockImageGenerationProvider().generate({
      prompt: "A clean product illustration",
      width: 320,
      height: 320,
      model: "mock-image-v1",
    });
    expect(result.buffer.length).toBeGreaterThan(100);
    expect(result.moderation.status).toBe("passed");
    expect(result.commercialUseMetadata.permitted).toBe(true);
  });
});
