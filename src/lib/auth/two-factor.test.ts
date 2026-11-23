import { beforeAll, describe, expect, it } from "vitest";
import * as OTPAuth from "otpauth";
import {
  decryptSecret,
  encryptSecret,
  mfaPendingToken,
  newRecoveryCodes,
  newTotpSecret,
  readMfaPending,
  consumeRecoveryCode,
  verifyTotp,
} from "./two-factor";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
});

describe("two-factor", () => {
  it("encrypts the secret so the stored value is not the secret", () => {
    const secret = newTotpSecret();
    const stored = encryptSecret(secret);
    expect(stored).not.toContain(secret);
    expect(decryptSecret(stored)).toBe(secret);
    expect(decryptSecret(stored.slice(0, -3) + "abc")).toBeNull();
  });

  it("accepts the current code and rejects others", () => {
    const secret = newTotpSecret();
    const code = new OTPAuth.TOTP({ secret, digits: 6, period: 30 }).generate();
    expect(verifyTotp(secret, code)).toBe(true);
    expect(verifyTotp(secret, code === "000000" ? "111111" : "000000")).toBe(false);
    expect(verifyTotp(secret, "abc")).toBe(false);
  });

  it("recovery codes work once", () => {
    const { codes, hashes } = newRecoveryCodes();
    const left = consumeRecoveryCode(hashes, codes[0].toUpperCase());
    expect(left).toHaveLength(hashes.length - 1);
    expect(consumeRecoveryCode(left!, codes[0])).toBeNull();
  });

  it("pending login token round-trips and rejects tampering", async () => {
    const token = await mfaPendingToken({ id: "u1", sessionVersion: 3 });
    expect(await readMfaPending(token)).toEqual({ userId: "u1", v: 3 });
    expect(await readMfaPending(token.slice(0, -2) + "xx")).toBeNull();
  });
});
