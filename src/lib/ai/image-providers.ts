import sharp from "sharp";

export type ImageGenerationRequest = {
  prompt: string;
  width: number;
  height: number;
  model: string;
};

export type ImageGenerationResult = {
  buffer: Buffer;
  mimeType: "image/png";
  provider: "MOCK";
  model: string;
  estimatedCostUsd: number;
  moderation: { status: "passed"; categories: string[] };
  commercialUseMetadata: { permitted: boolean; source: string };
};

export interface ImageGenerationProvider {
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

function escapeXml(value: string): string {
  return value.replace(
    /[<>&"']/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[character]!,
  );
}

export class MockImageGenerationProvider implements ImageGenerationProvider {
  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const label = escapeXml(request.prompt.slice(0, 90));
    const svg = `<svg width="${request.width}" height="${request.height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#172554"/><circle cx="${request.width * 0.82}" cy="${request.height * 0.2}" r="${Math.min(request.width, request.height) * 0.22}" fill="#38bdf8" opacity=".55"/><text x="${request.width * 0.08}" y="${request.height * 0.45}" fill="white" font-family="Arial, sans-serif" font-size="${Math.max(28, Math.floor(request.width / 18))}" font-weight="700">AI visual draft</text><text x="${request.width * 0.08}" y="${request.height * 0.56}" fill="#dbeafe" font-family="Arial, sans-serif" font-size="${Math.max(18, Math.floor(request.width / 34))}">${label}</text></svg>`;
    return {
      buffer: await sharp(Buffer.from(svg)).png().toBuffer(),
      mimeType: "image/png",
      provider: "MOCK",
      model: request.model,
      estimatedCostUsd: 0,
      moderation: { status: "passed", categories: [] },
      commercialUseMetadata: { permitted: true, source: "mock-provider-development-only" },
    };
  }
}

export function getImageGenerationProvider(provider: "MOCK"): ImageGenerationProvider {
  if (provider !== "MOCK") throw new Error("Image provider is not configured.");
  return new MockImageGenerationProvider();
}
