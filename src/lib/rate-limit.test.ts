import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  const limit = { max: 3, windowMs: 60_000 };
  it("allows up to max hits in the window, then blocks", () => {
    let t = 0;
    const r = new RateLimiter(new Map(), () => t);
    expect([r.hit("a", limit), r.hit("a", limit), r.hit("a", limit)]).toEqual([true, true, true]);
    expect(r.hit("a", limit)).toBe(false);
    expect(r.blocked("a", limit)).toBe(true);
    expect(r.hit("b", limit)).toBe(true);
    t = 30_000;
    expect(r.retryMinutes("a", limit)).toBe(1);
    t = 60_001;
    expect(r.blocked("a", limit)).toBe(false);
    expect(r.hit("a", limit)).toBe(true);
  });
  it("reset clears a key", () => {
    const r = new RateLimiter(new Map(), () => 0);
    for (let i = 0; i < 3; i++) r.hit("a", limit);
    r.reset("a");
    expect(r.blocked("a", limit)).toBe(false);
  });
});
