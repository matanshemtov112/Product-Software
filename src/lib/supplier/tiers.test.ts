import { describe, expect, it } from "vitest";
import { parseTiers } from "./tiers";

describe("parseTiers", () => {
  it("sorts tiers by threshold and converts to agorot", () => {
    const r = parseTiers([
      { id: "a", name: "רגיל", min: "0" },
      { id: "", name: "היקף גבוה", min: "100,000" },
      { id: "b", name: "עסקי", min: "₪20000" },
    ]);
    expect(r).toEqual({
      ok: true,
      tiers: [
        { id: "a", name: "רגיל", minMonthlyAgorot: 0 },
        { id: "b", name: "עסקי", minMonthlyAgorot: 2_000_000 },
        { id: null, name: "היקף גבוה", minMonthlyAgorot: 10_000_000 },
      ],
    });
  });

  it("rejects a missing zero tier, duplicate thresholds and empty names", () => {
    expect(parseTiers([{ id: "", name: "עסקי", min: "5000" }])).toMatchObject({ ok: false });
    expect(
      parseTiers([
        { id: "", name: "רגיל", min: "0" },
        { id: "", name: "עסקי", min: "0" },
      ]),
    ).toMatchObject({ ok: false, error: "לשתי מדרגות יש אותו סכום התחלה" });
    expect(parseTiers([{ id: "", name: "", min: "0" }])).toMatchObject({ ok: false });
    expect(parseTiers([])).toMatchObject({ ok: false });
  });
});
