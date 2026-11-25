import { describe, expect, it } from "vitest";
import { detectDocType, isVerified, requiredDocs, verification } from "./verification";

const now = new Date("2026-11-14T10:00:00Z");
const ok = (kind: "BUSINESS_LICENSE" | "MANUFACTURER_LICENSE" | "HEALTH_LICENSE", validUntil: Date | null = null) => ({
  kind,
  status: "APPROVED" as const,
  validUntil,
});

describe("verification", () => {
  it("needs only a business license from a distributor", () => {
    expect(requiredDocs(false)).toEqual(["BUSINESS_LICENSE"]);
    expect(verification([ok("BUSINESS_LICENSE")], false, now).verified).toBe(true);
  });
  it("needs manufacturer and health licenses from a factory", () => {
    expect(verification([ok("BUSINESS_LICENSE")], true, now).verified).toBe(false);
    const all = [ok("BUSINESS_LICENSE"), ok("MANUFACTURER_LICENSE"), ok("HEALTH_LICENSE", new Date("2027-03-01"))];
    const v = verification(all, true, now);
    expect(v.verified).toBe(true);
    expect(v.until).toEqual(new Date("2027-03-01"));
  });
  it("is not verified with a pending, rejected or expired document", () => {
    expect(verification([{ ...ok("BUSINESS_LICENSE"), status: "PENDING" }], false, now).verified).toBe(false);
    expect(verification([{ ...ok("BUSINESS_LICENSE"), status: "REJECTED" }], false, now).verified).toBe(false);
    const expired = verification([ok("BUSINESS_LICENSE", new Date("2026-11-01"))], false, now);
    expect(expired.verified).toBe(false);
    expect(expired.states[0].state).toBe("EXPIRED");
  });
  it("isVerified respects the validity date", () => {
    expect(isVerified({ verifiedAt: now, verifiedUntil: null }, now)).toBe(true);
    expect(isVerified({ verifiedAt: now, verifiedUntil: new Date("2026-11-13") }, now)).toBe(false);
    expect(isVerified({ verifiedAt: null, verifiedUntil: null }, now)).toBe(false);
  });
  it("detects file types by content", () => {
    expect(detectDocType(new TextEncoder().encode("%PDF-1.7 ..."))).toBe("application/pdf");
    expect(detectDocType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1]))).toBe("image/png");
    expect(detectDocType(new TextEncoder().encode("<html>"))).toBeNull();
  });
});
