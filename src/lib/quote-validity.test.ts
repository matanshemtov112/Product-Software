import { describe, expect, it } from "vitest";
import { quoteExpired, quoteValidUntil } from "./quote-validity";

describe("quote validity", () => {
  const sent = new Date("2026-11-17T08:00:00Z");
  it("is valid for 12 hours", () => {
    expect(quoteValidUntil(sent).toISOString()).toBe("2026-11-17T20:00:00.000Z");
    expect(quoteExpired(sent, new Date("2026-11-17T19:59:00Z"))).toBe(false);
    expect(quoteExpired(sent, new Date("2026-11-17T20:00:00Z"))).toBe(true);
  });
});
