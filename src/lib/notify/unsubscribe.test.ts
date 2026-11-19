import { describe, expect, it } from "vitest";
import { emailFooter, emailSubject, readUnsubscribeToken, unsubscribeToken } from "./unsubscribe";

describe("unsubscribe links", () => {
  it("reads back a signed token", () => {
    expect(readUnsubscribeToken(unsubscribeToken("user1", "SAVINGS"))).toEqual({
      userId: "user1",
      category: "SAVINGS",
    });
  });

  it("refuses a forged or changed token", () => {
    const token = unsubscribeToken("user1", "MARKETING");
    const [, sig] = token.split(".");
    const other = `${Buffer.from("user2.MARKETING").toString("base64url")}.${sig}`;
    expect(readUnsubscribeToken(other)).toBeNull();
    expect(readUnsubscribeToken("garbage")).toBeNull();
  });

  it("never unsubscribes from critical messages", () => {
    expect(readUnsubscribeToken(unsubscribeToken("user1", "CRITICAL"))).toBeNull();
  });
});

describe("marketing emails", () => {
  it("start with the word פרסומת", () => {
    expect(emailSubject("MARKETING", "מבצע")).toBe("פרסומת: מבצע");
    expect(emailSubject("OFFERS", "הצעה")).toBe("הצעה");
  });

  it("include an unsubscribe link and the sender details", () => {
    const lines = emailFooter({
      org: "CUSTOMER",
      category: "MARKETING",
      settingsUrl: "s",
      unsubscribeUrl: "https://x/unsubscribe?t=1",
    }).join("\n");
    expect(lines).toContain("https://x/unsubscribe?t=1");
    expect(lines).toContain("השולח:");
  });
});
