import { describe, expect, it } from "vitest";
import { lacking, roleCan, roleFits, ROLES_FOR } from "./permissions";

describe("team roles", () => {
  it("gives each role only its own permissions", () => {
    expect(roleCan("MANAGER", "manage")).toBe(true);
    expect(roleCan("BUYER", "buy")).toBe(true);
    expect(roleCan("BUYER", "manage")).toBe(false);
    expect(roleCan("PRICING", "prices")).toBe(true);
    expect(roleCan("PRICING", "reply")).toBe(false);
    expect(roleCan("SALES", "reply")).toBe(true);
    expect(roleCan("SALES", "prices")).toBe(false);
    expect(roleCan("VIEWER", "buy")).toBe(false);
    expect(roleCan("VIEWER", "report")).toBe(false);
  });

  it("offers buyer only to restaurants, pricing and sales only to suppliers", () => {
    expect(roleFits("CUSTOMER", "BUYER")).toBe(true);
    expect(roleFits("CUSTOMER", "PRICING")).toBe(false);
    expect(roleFits("SUPPLIER", "SALES")).toBe(true);
    expect(roleFits("SUPPLIER", "BUYER")).toBe(false);
    expect(roleFits("SUPPLIER", "ADMIN")).toBe(false);
    expect(ROLES_FOR.CUSTOMER).toContain("MANAGER");
  });

  it("lists what a role lacks", () => {
    expect(lacking("MANAGER")).toBe("");
    expect(lacking("VIEWER")).toBe("manage buy prices reply report");
    expect(lacking("SALES")).toBe("manage buy prices");
    expect(lacking(null)).toBe("manage buy prices reply report");
  });
});
