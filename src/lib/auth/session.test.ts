import { beforeAll, describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
});

describe("session tokens", () => {
  it("round-trips a session", async () => {
    const token = await signSession({ userId: "u1", role: "SUPPLIER", name: "דנה" });
    expect(await verifySession(token)).toEqual({ userId: "u1", role: "SUPPLIER", name: "דנה" });
  });

  it("rejects a tampered or missing token", async () => {
    const token = await signSession({ userId: "u1", role: "CUSTOMER", name: "x" });
    expect(await verifySession(token.slice(0, -2) + "xx")).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });
});
