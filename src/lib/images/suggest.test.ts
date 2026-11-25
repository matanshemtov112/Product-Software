import { describe, expect, it } from "vitest";
import {
  downloadSuggestion,
  isAllowedImageUrl,
  isFreeLicense,
  parseCommons,
  parseOpenFoodFacts,
  parsePageImages,
  readSuggestionChoice,
  suggestImages,
} from "./suggest";

const commonsPage = (license: string, url = "https://upload.wikimedia.org/a/400px-sugar.jpg", mime = "image/jpeg") => ({
  imageinfo: [
    {
      thumburl: url,
      descriptionurl: "https://commons.wikimedia.org/wiki/File:Sugar.jpg",
      mime,
      extmetadata: { LicenseShortName: { value: license }, Artist: { value: '<a href="x">Jane Doe</a>' } },
    },
  ],
});

describe("image suggestions", () => {
  it("accepts only free licenses that allow commercial use", () => {
    expect(isFreeLicense("CC BY-SA 4.0")).toBe(true);
    expect(isFreeLicense("CC0")).toBe(true);
    expect(isFreeLicense("Public domain")).toBe(true);
    expect(isFreeLicense("CC BY-NC 2.0")).toBe(false);
    expect(isFreeLicense("CC BY-ND 4.0")).toBe(false);
    expect(isFreeLicense("All rights reserved")).toBe(false);
    expect(isFreeLicense(undefined)).toBe(false);
  });

  it("only downloads from the open image hosts over https", () => {
    expect(isAllowedImageUrl("https://upload.wikimedia.org/x.jpg")).toBe(true);
    expect(isAllowedImageUrl("https://images.openfoodfacts.org/x.jpg")).toBe(true);
    // Commons מחזיר כיום תמונות מוקטנות מהשרת הזה
    expect(
      isAllowedImageUrl("https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Tomato.jpg/400px-Tomato.jpg"),
    ).toBe(true);
    expect(isAllowedImageUrl("http://upload.wikimedia.org/x.jpg")).toBe(false);
    expect(isAllowedImageUrl("https://localhost/x.jpg")).toBe(false);
    expect(isAllowedImageUrl("https://upload.wikimedia.org.evil.com/x.jpg")).toBe(false);
    expect(isAllowedImageUrl("https://upload.wikimedia.org:8443/x.jpg")).toBe(false);
    // תמונות שספקים העלו למערכת לעולם לא מוצעות
    expect(isAllowedImageUrl("https://app.example/api/offer-images/abc")).toBe(false);
  });

  it("keeps free Commons images with a credit and drops the rest", () => {
    const out = parseCommons({
      query: {
        pages: {
          1: commonsPage("CC BY-SA 4.0"),
          2: commonsPage("CC BY-NC 2.0", "https://upload.wikimedia.org/b.jpg"),
          3: commonsPage("CC0", "https://upload.wikimedia.org/c.svg", "image/svg+xml"),
          4: commonsPage("CC0", "https://example.com/d.jpg"),
        },
      },
    });
    expect(out).toHaveLength(1);
    expect(out[0].credit).toBe("צילום: Jane Doe, CC BY-SA 4.0, ויקישיתוף");
    expect(parseCommons({})).toEqual([]);
  });

  it("reads the front image from Open Food Facts", () => {
    const out = parseOpenFoodFacts(
      { product: { image_front_url: "https://images.openfoodfacts.org/f.jpg" } },
      "7290000",
    );
    expect(out[0]).toMatchObject({ source: "openfoodfacts", credit: "Open Food Facts, CC BY-SA" });
    expect(parseOpenFoodFacts({ status: 0 }, "1")).toEqual([]);
  });

  it("combines sources and ignores a source that fails", async () => {
    const fetcher = async (url: string) => {
      if (url.includes("openfoodfacts")) throw new Error("blocked");
      if (url.includes("he.wikipedia")) return Response.json({ query: { pages: { 1: { pageimage: "Sugar.jpg" } } } });
      if (url.includes("titles="))
        return Response.json({ query: { pages: { 1: commonsPage("CC0", "https://upload.wikimedia.org/w.jpg") } } });
      return Response.json({ query: { pages: { 1: commonsPage("CC BY 2.0") } } });
    };
    const out = await suggestImages({ name: "סוכר לבן", barcode: "7290000000001" }, fetcher);
    expect(out.map((s) => s.url)).toEqual([
      "https://upload.wikimedia.org/w.jpg",
      "https://upload.wikimedia.org/a/400px-sugar.jpg",
    ]);
    expect(await suggestImages({ name: "" }, fetcher)).toEqual([]);
  });

  it("reads only bitmap page images from Hebrew Wikipedia", () => {
    expect(
      parsePageImages({ query: { pages: { 1: { pageimage: "A.jpg" }, 2: { pageimage: "B.svg" }, 3: {} } } }),
    ).toEqual(["A.jpg"]);
  });

  it("validates the choice sent with the form", () => {
    const ok = { url: "https://upload.wikimedia.org/a.jpg", pageUrl: "https://commons.wikimedia.org/x", credit: "CC0" };
    expect(readSuggestionChoice(JSON.stringify(ok))).toEqual(ok);
    expect(readSuggestionChoice(JSON.stringify({ ...ok, url: "https://evil.com/a.jpg" }))).toBeNull();
    expect(readSuggestionChoice(JSON.stringify({ ...ok, credit: "" }))).toBeNull();
    expect(readSuggestionChoice("not json")).toBeNull();
    expect(readSuggestionChoice("")).toBeNull();
  });

  it("stops downloading past the size limit and refuses other hosts", async () => {
    const big = async () => new Response(new Uint8Array(5000));
    expect(await downloadSuggestion("https://upload.wikimedia.org/a.jpg", 1000, big)).toBeNull();
    const small = async () => new Response(new Uint8Array([1, 2, 3]));
    expect(await downloadSuggestion("https://upload.wikimedia.org/a.jpg", 1000, small)).toEqual(Buffer.from([1, 2, 3]));
    expect(await downloadSuggestion("https://evil.com/a.jpg", 1000, small)).toBeNull();
  });
});
