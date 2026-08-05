import { describe, expect, it } from "vitest";
import {
  knowledgeEntryCreateSchema,
  knowledgeEntryUpdateSchema,
  knowledgeRetrievalSchema,
} from "@/lib/validation/knowledge-base";

describe("knowledge-base validation", () => {
  it("accepts valid entry create input", () => {
    const result = knowledgeEntryCreateSchema.parse({
      type: "BRAND_GUIDELINE",
      title: "Logo usage",
      content: "Always use the primary logo on white backgrounds.",
    });
    expect(result.type).toBe("BRAND_GUIDELINE");
    expect(result.title).toBe("Logo usage");
  });

  it("rejects empty content", () => {
    expect(() =>
      knowledgeEntryCreateSchema.parse({
        type: "FAQ",
        title: "Question",
        content: "",
      }),
    ).toThrow();
  });

  it("requires expectedVersion on update", () => {
    expect(() =>
      knowledgeEntryUpdateSchema.parse({
        title: "Updated",
      }),
    ).toThrow();

    const result = knowledgeEntryUpdateSchema.parse({
      title: "Updated",
      expectedVersion: 2,
    });
    expect(result.expectedVersion).toBe(2);
  });

  it("defaults approvedOnly to true for retrieval", () => {
    const result = knowledgeRetrievalSchema.parse({
      organisationId: "clh1234567890abcdefghij",
      query: "tone of voice",
    });
    expect(result.approvedOnly).toBe(true);
    expect(result.limit).toBe(20);
  });
});
