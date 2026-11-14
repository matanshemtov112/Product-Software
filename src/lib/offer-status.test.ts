import { describe, expect, it } from "vitest";
import { canCancel, canDecide, offerStage, offerStageNote } from "./offer-status";

const now = new Date("2026-11-11T10:00:00Z");
const base = { offeredAt: null, offerSeenAt: null, outcome: null, validUntil: null };

describe("offerStage", () => {
  it("moves from new to sent to viewed", () => {
    expect(offerStage(base, now)).toBe("NEW");
    const sent = { ...base, offeredAt: new Date("2026-11-10") };
    expect(offerStage(sent, now)).toBe("SENT");
    expect(offerStage({ ...sent, offerSeenAt: now }, now)).toBe("VIEWED");
  });
  it("expires an open offer after its validity, but keeps a decided one", () => {
    const old = { ...base, offeredAt: new Date("2026-11-01"), validUntil: new Date("2026-11-05") };
    expect(offerStage(old, now)).toBe("EXPIRED");
    expect(offerStage({ ...old, outcome: "ACCEPTED" }, now)).toBe("ACCEPTED");
  });
  it("an outcome wins over everything", () => {
    expect(offerStage({ ...base, outcome: "CANCELLED" }, now)).toBe("CANCELLED");
  });
});

describe("permissions", () => {
  it("customer decides only on an open offer", () => {
    expect(canDecide("SENT")).toBe(true);
    expect(canDecide("VIEWED")).toBe(true);
    expect(canDecide("NEW")).toBe(false);
    expect(canDecide("EXPIRED")).toBe(false);
  });
  it("customer can cancel a new request, supplier only a sent offer", () => {
    expect(canCancel("NEW", "CUSTOMER")).toBe(true);
    expect(canCancel("NEW", "SUPPLIER")).toBe(false);
    expect(canCancel("VIEWED", "SUPPLIER")).toBe(true);
    expect(canCancel("ACCEPTED", "CUSTOMER")).toBe(false);
  });
});

describe("offerStageNote", () => {
  it("names who cancelled and the reason", () => {
    expect(offerStageNote("CANCELLED", "SUPPLIER", { cancelledBy: "CUSTOMER", outcomeNote: "מצאנו ספק" })).toBe(
      "הלקוח ביטל את הבקשה. סיבה: מצאנו ספק",
    );
    expect(offerStageNote("CANCELLED", "CUSTOMER", { cancelledBy: "SUPPLIER" })).toBe("הספק ביטל את ההצעה.");
  });
});
