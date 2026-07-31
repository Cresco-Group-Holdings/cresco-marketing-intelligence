/**
 * Splits an array into fixed-size chunks for batch ingestion.
 */
export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize < 1) {
    throw new Error("chunkSize must be at least 1");
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}
