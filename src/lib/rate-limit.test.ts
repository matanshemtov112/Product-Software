import { describe, expect, it } from "vitest";
import { MemoryStore, RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  const limit = { max: 3, windowMs: 60_000 };
  it("allows up to max hits in the window, then blocks", async () => {
    let t = 0;
    const r = new RateLimiter(new MemoryStore(), () => t);
    expect([await r.hit("a", limit), await r.hit("a", limit), await r.hit("a", limit)]).toEqual([true, true, true]);
    expect(await r.hit("a", limit)).toBe(false);
    expect(await r.blocked("a", limit)).toBe(true);
    expect(await r.hit("b", limit)).toBe(true);
    t = 30_000;
    expect(await r.retryMinutes("a", limit)).toBe(1);
    t = 60_001;
    expect(await r.blocked("a", limit)).toBe(false);
    expect(await r.hit("a", limit)).toBe(true);
  });
  it("keeps blocking while attempts continue", async () => {
    let t = 0;
    const r = new RateLimiter(new MemoryStore(), () => t);
    for (let i = 0; i < 3; i++) await r.hit("a", limit);
    t = 50_000;
    expect(await r.hit("a", limit)).toBe(false);
    t = 60_001;
    // the attempt at 50s still counts, together with nothing else: 1 of 3
    expect(await r.blocked("a", limit)).toBe(false);
  });
  it("reset clears a key", async () => {
    const r = new RateLimiter(new MemoryStore(), () => 0);
    for (let i = 0; i < 3; i++) await r.hit("a", limit);
    await r.reset("a");
    expect(await r.blocked("a", limit)).toBe(false);
  });
});
