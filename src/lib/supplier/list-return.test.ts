import { describe, expect, it } from "vitest";
import { listQuery, listUrl } from "./list-return";

describe("list return", () => {
  it("keeps search, category and view, and points at the saved product", () => {
    const back = listQuery({ q: "ביצים", view: "grid" });
    expect(listUrl(back, "o1")).toBe(`/supplier?q=${encodeURIComponent("ביצים")}&view=grid&saved=o1#offer-o1`);
  });
  it("drops anything else and never leaves the supplier list", () => {
    expect(listUrl("next=https://evil.example&view=list")).toBe("/supplier?view=list");
    expect(listUrl(null)).toBe("/supplier");
  });
});
