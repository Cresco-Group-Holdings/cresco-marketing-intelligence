import { loadSharp } from "@/lib/images/sharp-loader";

export async function generateImageThumbnail(buffer: Buffer): Promise<Buffer | null> {
  try {
    const sharp = await loadSharp();
    return sharp(buffer, { failOn: "error" })
      .rotate()
      .resize(400, 400, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return null;
  }
}
