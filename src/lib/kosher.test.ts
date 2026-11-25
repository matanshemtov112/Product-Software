import { describe, expect, it } from "vitest";
import { effectiveKosher, kosherOfferWhere, kosherText, meetsKosher } from "./kosher";

describe("kosher", () => {
  it("offer marking wins over the supplier default", () => {
    expect(effectiveKosher({ kosher: "MEHADRIN" }, { kosherDefault: "KOSHER", kosherAuthority: "רבנות" })).toEqual({
      level: "MEHADRIN",
      authority: "רבנות",
    });
    expect(effectiveKosher({ kosher: null }, { kosherDefault: "KOSHER", kosherAuthority: "רבנות" }).level).toBe(
      "KOSHER",
    );
    expect(effectiveKosher({ kosher: "NONE" }, { kosherDefault: "KOSHER", kosherAuthority: "רבנות" })).toEqual({
      level: "NONE",
      authority: null,
    });
    expect(effectiveKosher({ kosher: null }, { kosherDefault: null }).level).toBeNull();
  });

  it("mehadrin satisfies kosher, unmarked satisfies nothing", () => {
    expect(meetsKosher("MEHADRIN", "KOSHER")).toBe(true);
    expect(meetsKosher("KOSHER", "MEHADRIN")).toBe(false);
    expect(meetsKosher(null, "KOSHER")).toBe(false);
    expect(meetsKosher(null, "NONE")).toBe(true);
    expect(meetsKosher("NONE", "KOSHER")).toBe(false);
  });

  it("builds no filter when kosher is not required", () => {
    expect(kosherOfferWhere("NONE")).toEqual({});
    expect(kosherOfferWhere(undefined)).toEqual({});
    expect(JSON.stringify(kosherOfferWhere("MEHADRIN"))).toContain('"in":["MEHADRIN"]');
  });

  it("formats text", () => {
    expect(kosherText({ level: "KOSHER", authority: "רבנות חיפה" })).toBe("כשר · רבנות חיפה");
    expect(kosherText({ level: null, authority: null })).toBeNull();
  });
});
