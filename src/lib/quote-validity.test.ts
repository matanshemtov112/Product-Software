import { describe, expect, it } from "vitest";
import { lockEnded, lockedUntil, pageStale, reminderDue } from "./quote-validity";

const HOUR = 3_600_000;

describe("inquiry timing", () => {
  const sent = new Date("2026-11-17T08:00:00Z");
  it("locks prices for 3 days after sending", () => {
    expect(lockedUntil(sent).toISOString()).toBe("2026-11-20T08:00:00.000Z");
    expect(lockEnded(sent, new Date("2026-11-20T07:59:00Z"))).toBe(false);
    expect(lockEnded(sent, new Date("2026-11-20T08:00:00Z"))).toBe(true);
  });
  it("reminds after 24 hours, until the lock ends", () => {
    expect(reminderDue(sent, new Date(sent.getTime() + 23 * HOUR))).toBe(false);
    expect(reminderDue(sent, new Date(sent.getTime() + 24 * HOUR))).toBe(true);
    expect(reminderDue(sent, new Date(sent.getTime() + 72 * HOUR))).toBe(false);
  });
  it("treats a page opened more than 12 hours ago as stale", () => {
    const now = Date.now();
    expect(pageStale(now - 11 * HOUR, now)).toBe(false);
    expect(pageStale(now - 13 * HOUR, now)).toBe(true);
    expect(pageStale(Number.NaN, now)).toBe(true);
  });
});
