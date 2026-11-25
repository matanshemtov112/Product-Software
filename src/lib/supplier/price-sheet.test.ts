import { describe, expect, it } from "vitest";
import {
  cellAgorot,
  findColumns,
  parseCsv,
  previewSheet,
  priceListCsv,
  type SheetOffer,
  type SheetTier,
} from "./price-sheet";

const tiers: SheetTier[] = [
  { id: "t1", name: "רגיל", minMonthlyAgorot: 0 },
  { id: "t2", name: "כסף", minMonthlyAgorot: 500_000 },
];
const base = {
  packType: null,
  packSizeMax: null,
  brand: null,
  barcode: null,
  available: true,
  supplierProductName: null,
};
const offers: SheetOffer[] = [
  {
    ...base,
    id: "o1",
    productName: "עגבניות",
    supplierSku: "A1",
    unit: "KG",
    packSize: 1,
    pricePerPack: false,
    prices: { t1: 500, t2: 480 },
  },
  {
    ...base,
    id: "o2",
    productName: "שמן קנולה",
    supplierSku: "B2",
    barcode: "729000",
    unit: "LITER",
    packSize: 18,
    pricePerPack: true,
    prices: { t1: 1000, t2: 970 },
  },
  {
    ...base,
    id: "o3",
    productName: "אורז",
    supplierSku: null,
    unit: "KG",
    packSize: 5,
    pricePerPack: false,
    prices: { t1: 700 },
  },
  {
    ...base,
    id: "o4",
    productName: "אורז",
    supplierSku: null,
    unit: "KG",
    packSize: 25,
    pricePerPack: false,
    prices: { t1: 650 },
  },
];
const never = () => false;

describe("price sheet", () => {
  it("round-trips the downloaded CSV with no changes", () => {
    const csv = priceListCsv(offers, tiers);
    expect(csv.startsWith("﻿")).toBe(true);
    const preview = previewSheet(parseCsv(csv), offers, tiers, never);
    if ("error" in preview) throw new Error(preview.error);
    expect(preview.rows).toEqual([]);
    expect(preview.unchanged).toBe(4);
    expect(preview.missing).toBe(0);
  });

  it("finds changed prices, per-pack conversion and availability", () => {
    const rows = parseCsv(priceListCsv(offers, tiers));
    const head = rows[0];
    const t1 = head.indexOf("מחיר רגיל");
    const avail = head.indexOf("זמין");
    rows[1][t1] = "5.50";
    rows[2][t1] = "190"; // 18 ליטר לאריזה: 190 ₪ לאריזה
    rows[3][avail] = "לא";
    const preview = previewSheet(rows, offers, tiers, (from, to) => from !== null && Math.abs(to - from) / from > 0.3);
    if ("error" in preview) throw new Error(preview.error);
    expect(preview.rows).toHaveLength(3);
    expect(preview.rows[0].changes[0]).toMatchObject({
      tierId: "t1",
      fromAgorot: 500,
      toAgorot: 550,
      needsApproval: false,
    });
    expect(preview.rows[1].changes[0]).toMatchObject({ fromSheet: 18000, toSheet: 19000, toAgorot: 1056 });
    expect(preview.rows[2]).toMatchObject({ offerId: "o3", available: false, changes: [] });
  });

  it("matches by SKU or name when there is no id column, and flags ambiguous packs", () => {
    const rows = [
      ["מק״ט", "מוצר", "מחיר"],
      ["B2", "", "200"],
      ["", "עגבניות", "6"],
      ["", "אורז", "8"],
      ["", "חציל", "3"],
    ];
    const one = [tiers[0]];
    const preview = previewSheet(rows, offers, one, never);
    if ("error" in preview) throw new Error(preview.error);
    expect(preview.rows.map((r) => r.offerId ?? r.error?.slice(0, 10))).toEqual([
      "o2",
      "o1",
      "יש לכם כמה",
      "לא מצאנו א",
    ]);
  });

  it("rejects bad prices and duplicate rows", () => {
    const rows = [
      ["מזהה", "מחיר"],
      ["o1", "abc"],
      ["o3", "8"],
      ["o3", "9"],
    ];
    const preview = previewSheet(rows, offers, [tiers[0]], never);
    if ("error" in preview) throw new Error(preview.error);
    expect(preview.rows[0].error).toContain("לא תקין");
    expect(preview.rows[1].changes[0].toAgorot).toBe(800);
    expect(preview.rows[2].error).toContain("כבר מופיע");
  });

  it("explains a file without known columns", () => {
    expect(
      previewSheet(
        [
          ["a", "b"],
          ["1", "2"],
        ],
        offers,
        tiers,
        never,
      ),
    ).toHaveProperty("error");
    expect(findColumns([["כותרת"], ['מק"ט', "מחיר"]], [tiers[0]])?.headerRow).toBe(1);
  });

  it("parses price cells and CSV quoting", () => {
    expect(cellAgorot(12.5)).toBe(1250);
    expect(cellAgorot("₪ 1,234.50")).toBe(123450);
    expect(cellAgorot("34,90")).toBe(3490);
    expect(cellAgorot("")).toBeNull();
    expect(Number.isNaN(cellAgorot("-3"))).toBe(true);
    expect(parseCsv('a;"b;c";"d ""q"""\r\n1;2;3\n')).toEqual([
      ["a", "b;c", 'd "q"'],
      ["1", "2", "3"],
    ]);
  });

  it("escapes formula-looking cells in the download", () => {
    const csv = priceListCsv([{ ...offers[0], supplierProductName: "=HYPERLINK(1)" }], [tiers[0]]);
    expect(csv).toContain("'=HYPERLINK(1)");
  });
});
