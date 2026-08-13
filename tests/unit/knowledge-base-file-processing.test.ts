import { describe, expect, it } from "vitest";
import {
  buildKnowledgeDocumentStorageKey,
  processKnowledgeDocumentUpload,
} from "@/lib/knowledge-base/file-processing";

describe("knowledge document file processing", () => {
  it("rejects executable extensions", async () => {
    await expect(
      processKnowledgeDocumentUpload("malware.exe", Buffer.from("fake")),
    ).rejects.toThrow(/not allowed/i);
  });

  it("accepts plain text uploads and extracts content", async () => {
    const result = await processKnowledgeDocumentUpload(
      "notes.txt",
      Buffer.from("Approved brand claim text."),
    );
    expect(result.mimeType).toBe("text/plain");
    expect(result.extractedText).toBe("Approved brand claim text.");
  });

  it("blocks path traversal in storage keys", () => {
    const key = buildKnowledgeDocumentStorageKey(
      "org-1",
      "brand-1",
      "doc-1",
      "../../etc/passwd",
    );
    expect(key).not.toContain("..");
    expect(key).toMatch(/^org-1\/brand-1\/knowledge\/doc-1\//);
  });

  it("rejects blocked html uploads by extension", async () => {
    await expect(
      processKnowledgeDocumentUpload("page.html", Buffer.from("<script>alert(1)</script>")),
    ).rejects.toThrow(/not allowed/i);
  });
});
