import { describe, expect, it } from "vitest";
import { MockVoiceProvider } from "@/lib/ai/voice-providers";
import {
  renderRequestSchema,
  subtitleSchema,
  videoProjectCreateSchema,
  voiceoverSchema,
} from "@/lib/validation/video-studio";

describe("video production pipeline", () => {
  it("creates a bounded vertical-video brief", () => {
    const result = videoProjectCreateSchema.safeParse({
      title: "Explainer",
      videoType: "EDUCATIONAL_EXPLAINER",
      script: "A short approved script.",
      targetDuration: 30,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.aspectRatio).toBe("9:16");
  });
  it("allows only approved voices and estimates duration", async () => {
    expect(voiceoverSchema.safeParse({ voiceId: "unapproved", language: "en" }).success).toBe(
      false,
    );
    const preview = await new MockVoiceProvider().preview(
      "One two three four five",
      "approved-en-us-neutral",
    );
    expect(preview.durationSeconds).toBeGreaterThan(0);
  });
  it("rejects invalid subtitle timing and accepts idempotent render requests", () => {
    expect(
      subtitleSchema.safeParse({ cues: [{ start: 2, end: 1, text: "Invalid" }] }).success,
    ).toBe(true);
    expect(renderRequestSchema.safeParse({ idempotencyKey: "render-1" }).success).toBe(true);
  });
});
