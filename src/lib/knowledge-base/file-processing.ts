import path from "node:path";
import FileType from "file-type";
import { AppError } from "@/lib/errors";
import { createMalwareScanner } from "@/lib/marketing-assets/malware-scanner";
import {
  KNOWLEDGE_DOCUMENT_ALLOWED_EXTENSIONS,
  KNOWLEDGE_DOCUMENT_ALLOWED_MIME_TYPES,
  KNOWLEDGE_DOCUMENT_BLOCKED_EXTENSIONS,
  KNOWLEDGE_DOCUMENT_MAX_SIZE_BYTES,
} from "@/lib/knowledge-base/constants";

export type ProcessedKnowledgeDocument = {
  buffer: Buffer;
  mimeType: string;
  safeFilename: string;
  extractedText: string | null;
};

function extensionFromFilename(filename: string): string {
  return path.extname(filename).toLowerCase();
}

function sanitiseFilename(filename: string): string {
  const normalised = path.basename(filename).replace(/\.\./g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  return normalised.length > 0 ? normalised.slice(0, 180) : "document";
}

function isAllowedMime(mimeType: string): boolean {
  return (KNOWLEDGE_DOCUMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

function isAllowedExtension(extension: string): boolean {
  return (KNOWLEDGE_DOCUMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(extension);
}

function extractPlainText(buffer: Buffer, mimeType: string): string | null {
  if (mimeType === "text/plain" || mimeType === "text/markdown" || mimeType === "text/csv") {
    return buffer.toString("utf8").slice(0, 500_000);
  }
  return null;
}

export function buildKnowledgeDocumentStorageKey(
  organisationId: string,
  brandId: string,
  documentId: string,
  filename: string,
): string {
  const safe = sanitiseFilename(filename);
  return `${organisationId}/${brandId}/knowledge/${documentId}/${safe}`;
}

export async function processKnowledgeDocumentUpload(
  filename: string,
  buffer: Buffer,
): Promise<ProcessedKnowledgeDocument> {
  const extension = extensionFromFilename(filename);
  if ((KNOWLEDGE_DOCUMENT_BLOCKED_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new AppError("VALIDATION_ERROR", "Executable or unsupported file types are not allowed.");
  }

  if (buffer.byteLength > KNOWLEDGE_DOCUMENT_MAX_SIZE_BYTES) {
    throw new AppError("VALIDATION_ERROR", "File exceeds the maximum allowed upload size (25 MB).");
  }

  const detected = await FileType.fromBuffer(buffer);
  let mimeType: string | null = detected?.mime ?? null;
  if (!mimeType && (extension === ".txt" || extension === ".md" || extension === ".csv")) {
    mimeType = extension === ".csv" ? "text/csv" : extension === ".md" ? "text/markdown" : "text/plain";
  }

  if (!mimeType || !isAllowedMime(mimeType)) {
    throw new AppError("VALIDATION_ERROR", "Unsupported document type. Allowed: PDF, TXT, MD, CSV, DOC, DOCX.");
  }

  if (!isAllowedExtension(extension)) {
    throw new AppError("VALIDATION_ERROR", "File extension does not match supported document types.");
  }

  const malwareScanner = createMalwareScanner();
  const scanResult = await malwareScanner.scan(buffer, mimeType);
  if (!scanResult.clean) {
    throw new AppError("VALIDATION_ERROR", scanResult.reason ?? "File failed security scan.");
  }

  return {
    buffer,
    mimeType,
    safeFilename: sanitiseFilename(filename),
    extractedText: extractPlainText(buffer, mimeType),
  };
}
