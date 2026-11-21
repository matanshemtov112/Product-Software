import { describe, expect, it } from "vitest";
import { singleSupplierNote } from "./product-comparison";

describe("single supplier note", () => {
  it("says the only supplier is cheaper, without calling it the cheapest", () => {
    const note = singleSupplierNote(12, false);
    expect(note).toContain("רק ספק אחד");
    expect(note).toContain("12%");
    expect(note).toContain("להוזיל");
  });

  it("does not claim savings when the customer already pays less", () => {
    expect(singleSupplierNote(-5, false)).not.toContain("להוזיל");
    expect(singleSupplierNote(-5, false)).toContain("טוב ממנו");
    expect(singleSupplierNote(0, false)).toContain("זהה");
  });

  it("explains when the only supplier is the customer's own", () => {
    expect(singleSupplierNote(0, true)).toContain("רק הספק שלכם");
  });
});
