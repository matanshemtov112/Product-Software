import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const stored = await hashPassword("s3cret-pass");
    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(await verifyPassword("s3cret-pass", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });

  it("rejects a malformed stored value", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  });
});
