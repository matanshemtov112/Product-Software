import { describe, expect, it } from "vitest";
import { distanceKm, insideAny, isNearIsrael, servesCustomer } from "./geo";

const telAviv = { lat: 32.0853, lng: 34.7818 };
const jerusalem = { lat: 31.7683, lng: 35.2137 };
const haifa = { lat: 32.794, lng: 34.9896 };

describe("distanceKm", () => {
  it("measures real distances between cities", () => {
    expect(distanceKm(telAviv, jerusalem)).toBeGreaterThan(50);
    expect(distanceKm(telAviv, jerusalem)).toBeLessThan(57);
    expect(distanceKm(telAviv, telAviv)).toBe(0);
  });
});

describe("insideAny", () => {
  it("a point is inside a circle when it is within its radius", () => {
    expect(insideAny([{ ...telAviv, radiusKm: 20 }], { lat: 32.0, lng: 34.8 })).toBe(true);
    expect(insideAny([{ ...telAviv, radiusKm: 20 }], jerusalem)).toBe(false);
    expect(insideAny([{ ...telAviv, radiusKm: 20 }, { ...jerusalem, radiusKm: 5 }], jerusalem)).toBe(true);
    expect(insideAny([], telAviv)).toBe(false);
  });
});

describe("isNearIsrael", () => {
  it("accepts Israeli cities and rejects points far away", () => {
    expect(isNearIsrael(haifa)).toBe(true);
    expect(isNearIsrael({ lat: 29.55, lng: 34.95 })).toBe(true); // אילת
    expect(isNearIsrael({ lat: 48.85, lng: 2.35 })).toBe(false);
  });
});

describe("servesCustomer", () => {
  const center = { regionId: "center", point: telAviv };
  it("a supplier with map areas serves only customers inside them", () => {
    const supplier = { areas: [{ ...haifa, radiusKm: 30 }], regionIds: ["center"] };
    expect(servesCustomer(supplier, center)).toBe(false);
    expect(servesCustomer(supplier, { regionId: "north", point: haifa })).toBe(true);
  });
  it("a supplier without map areas serves by general region", () => {
    expect(servesCustomer({ areas: [], regionIds: ["center"] }, center)).toBe(true);
    expect(servesCustomer({ areas: [], regionIds: ["north"] }, center)).toBe(false);
  });
  it("a customer not yet on the map is matched by general region", () => {
    const supplier = { areas: [{ ...haifa, radiusKm: 30 }], regionIds: ["center"] };
    expect(servesCustomer(supplier, { regionId: "center", point: null })).toBe(true);
  });
});
