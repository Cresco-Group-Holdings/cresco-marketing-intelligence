import { z } from "zod";

export const aiDiagnosticsTestSchema = z.object({
  mode: z.enum(["text", "structured"]).default("text"),
  userInput: z.string().trim().min(1).max(500).default("Reply with a short safe acknowledgement."),
  provider: z.enum(["OPENAI", "ANTHROPIC", "GOOGLE", "MOCK"]).optional(),
  model: z.string().trim().max(120).optional(),
  brandId: z.string().cuid().optional(),
});

export type AIDiagnosticsTestInput = z.infer<typeof aiDiagnosticsTestSchema>;
