import { describe, expect, it } from "vitest";
import { sanitizeCsvCell } from "@/lib/warehouse/csv-safety";

describe("warehouse CSV safety", () => {
  it("prefixes formula injection cells", () => {
    expect(sanitizeCsvCell("=1+1")).toBe("'=1+1");
    expect(sanitizeCsvCell("+cmd|'/c calc'!A0")).toBe("'+cmd|'/c calc'!A0");
    expect(sanitizeCsvCell("-2+3")).toBe("'-2+3");
    expect(sanitizeCsvCell("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
  });

  it("leaves safe values unchanged", () => {
    expect(sanitizeCsvCell("summer-campaign")).toBe("summer-campaign");
    expect(sanitizeCsvCell("42")).toBe("42");
  });
});
